#!/usr/bin/env node
/**
 * Deduplicate Plaid items in DynamoDB.
 *
 * After a PLAID_ENCRYPTION_KEY rotation, users who reconnected their banks
 * end up with duplicate items (old item with undecryptable token + new item
 * with valid token for the same institution). This script identifies and
 * removes the stale duplicates, keeping only the newest valid item per
 * institution per user.
 *
 * Also clears S3 accounts caches for affected orgs so stale data isn't served.
 *
 * Usage:
 *   node scripts/dedupe-plaid-items.mjs                  # dry-run
 *   node scripts/dedupe-plaid-items.mjs --confirm        # actually delete
 *   node scripts/dedupe-plaid-items.mjs --table MyTable  # override table name
 */
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { PlaidApi, PlaidEnvironments, Configuration } from 'plaid'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'node:crypto'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const args = process.argv.slice(2)
function flag(name) { return args.includes(`--${name}`) }
function opt(name) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null
}

const TABLE   = opt('table')  || process.env.TOKENS_TABLE || 'PlaidTokens'
const BUCKET  = opt('bucket') || process.env.S3_BUCKET || 'rag-consulting-burndown'
const REGION  = opt('region') || process.env.AWS_REGION || process.env.S3_REGION || 'us-west-1'
const CONFIRM = flag('confirm')

const ACCESS_TOKEN_RE = /^access-(sandbox|development|production)-[a-f0-9-]+$/

const dynamo = new DynamoDBClient({ region: REGION })
const s3     = new S3Client({ region: REGION })

// ── Encryption helpers (mirrors backend/src/lib/encryption.mjs) ──

function getEncryptionKey() {
  const raw = process.env.PLAID_ENCRYPTION_KEY
  if (!raw) return null
  return crypto.createHash('sha256').update(raw).digest()
}

function tryDecrypt(encoded) {
  const key = getEncryptionKey()
  if (!key) return null
  try {
    const buf = Buffer.from(encoded, 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const ciphertext = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

/**
 * Resolves a stored token to its plaintext form, or null if undecryptable.
 */
function resolveToken(token) {
  if (!token) return null
  if (ACCESS_TOKEN_RE.test(token)) return token          // already plaintext
  const decrypted = tryDecrypt(token)
  if (decrypted && ACCESS_TOKEN_RE.test(decrypted)) return decrypted
  return null
}

// ── Plaid client (best-effort, for itemRemove) ──

function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret   = process.env.PLAID_SECRET
  const env      = process.env.PLAID_ENV || 'sandbox'
  if (!clientId || !secret) return null
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: { headers: { 'PLAID-CLIENT-ID': clientId, 'PLAID-SECRET': secret } },
  })
  return new PlaidApi(config)
}

// ── DynamoDB scan ──

async function scanAllItems() {
  const items = []
  let lastKey
  do {
    const res = await dynamo.send(new ScanCommand({
      TableName: TABLE,
      ExclusiveStartKey: lastKey,
    }))
    items.push(...(res.Items || []))
    lastKey = res.LastEvaluatedKey
  } while (lastKey)
  return items
}

// ── S3 cache cleanup ──

async function deleteAccountsCaches(affectedOrgs) {
  let deleted = 0
  for (const orgId of affectedOrgs) {
    const key = orgId ? `orgs/${orgId}/plaid-accounts-cache.json` : 'plaid-accounts-cache.json'
    try {
      if (CONFIRM) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
      }
      deleted++
      console.log(`  ${CONFIRM ? 'Deleted' : 'Would delete'} s3://${BUCKET}/${key}`)
    } catch (e) {
      if (e.name !== 'NoSuchKey') {
        console.log(`  Warning: failed to delete ${key}: ${e.message}`)
      }
    }
  }
  return deleted
}

// ── Main ──

async function main() {
  console.log(`\nTable:  ${TABLE}`)
  console.log(`Bucket: ${BUCKET}`)
  console.log(`Region: ${REGION}`)
  console.log(`Mode:   ${CONFIRM ? 'DELETE (for real!)' : 'DRY RUN (pass --confirm to delete)'}\n`)

  const plaid = getPlaidClient()
  if (!plaid) {
    console.log('Warning: Plaid credentials not configured — will skip itemRemove calls.\n')
  }

  // 1. Scan all items
  const rawItems = await scanAllItems()

  // Filter to actual Plaid items (skip budget/cooldown/config rows)
  const plaidItems = rawItems.filter(item => {
    const userId = item.userId?.S || ''
    return !userId.startsWith('_')
  })

  console.log(`Found ${plaidItems.length} Plaid item(s) in DynamoDB.\n`)

  // 2. Parse and classify
  const parsed = plaidItems.map(item => {
    const userId          = item.userId?.S || '?'
    const itemId          = item.itemId?.S || '?'
    const institutionId   = item.institutionId?.S || null
    const institutionName = item.institutionName?.S || 'unknown'
    const rawToken        = item.accessToken?.S || ''
    const createdAt       = item.createdAt?.S || item.updatedAt?.S || '1970-01-01T00:00:00Z'
    const resolvedToken   = resolveToken(rawToken)

    return {
      userId, itemId, institutionId, institutionName,
      rawToken, resolvedToken,
      isValid: !!resolvedToken,
      createdAt,
    }
  })

  // 3. Group by userId + institutionId (fall back to institutionName)
  const groups = new Map()
  for (const item of parsed) {
    const groupKey = `${item.userId}::${item.institutionId || item.institutionName}`
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey).push(item)
  }

  // 4. For each group, decide what to keep
  const toKeep = []
  const toRemove = []

  for (const [groupKey, items] of groups) {
    if (items.length === 1) {
      toKeep.push(items[0])
      continue
    }

    // Sort: valid first, then by createdAt descending (newest first)
    items.sort((a, b) => {
      if (a.isValid !== b.isValid) return a.isValid ? -1 : 1
      return new Date(b.createdAt) - new Date(a.createdAt)
    })

    const keeper = items[0]
    toKeep.push(keeper)
    for (let i = 1; i < items.length; i++) {
      toRemove.push(items[i])
    }
  }

  // 5. Report
  console.log('=== KEEP ===')
  for (const item of toKeep) {
    const status = item.isValid ? 'valid' : 'INVALID (needs reconnect)'
    console.log(`  [KEEP]   ${item.userId} / ${item.itemId} — ${item.institutionName} [${status}] (${item.createdAt})`)
  }

  console.log(`\n=== REMOVE (${toRemove.length} duplicate(s)) ===`)
  if (toRemove.length === 0) {
    console.log('  No duplicates found!')
    return
  }
  for (const item of toRemove) {
    const status = item.isValid ? 'valid' : 'invalid'
    console.log(`  [REMOVE] ${item.userId} / ${item.itemId} — ${item.institutionName} [${status}] (${item.createdAt})`)
  }

  // 6. Execute removals
  const affectedOrgs = new Set()
  if (CONFIRM || toRemove.length > 0) {
    console.log('')
  }

  for (const item of toRemove) {
    affectedOrgs.add(item.userId)

    // Best-effort Plaid itemRemove
    if (plaid && item.resolvedToken) {
      try {
        await plaid.itemRemove({ access_token: item.resolvedToken })
        console.log(`  Plaid itemRemove OK for ${item.itemId}`)
      } catch (e) {
        console.log(`  Plaid itemRemove failed for ${item.itemId}: ${e.message} (continuing)`)
      }
    }

    // Delete from DynamoDB
    if (CONFIRM) {
      await dynamo.send(new DeleteItemCommand({
        TableName: TABLE,
        Key: {
          userId: { S: item.userId },
          itemId: { S: item.itemId },
        },
      }))
      console.log(`  Deleted ${item.itemId} from DynamoDB`)
    }
  }

  // 7. Clear accounts caches
  if (affectedOrgs.size > 0) {
    console.log(`\nAccounts caches:`)
    await deleteAccountsCaches(affectedOrgs)
  }

  console.log(`\n${CONFIRM ? 'Done!' : 'Dry run complete.'} ${toRemove.length} duplicate(s) ${CONFIRM ? 'removed' : 'would be removed'}, ${toKeep.length} item(s) kept.`)
  if (!CONFIRM && toRemove.length > 0) {
    console.log(`\nRe-run with --confirm to actually delete.\n`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
