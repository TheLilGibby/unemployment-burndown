#!/usr/bin/env node
/**
 * Wipe all Plaid access tokens from DynamoDB.
 *
 * Use this when the PLAID_ENCRYPTION_KEY has been lost/rotated and stored
 * tokens can no longer be decrypted. After running, users will need to
 * reconnect their bank accounts via Plaid Link.
 *
 * Also clears the S3 accounts cache so stale data isn't served.
 *
 * Usage:
 *   node scripts/wipe-plaid-tokens.mjs                  # dry-run (shows what would be deleted)
 *   node scripts/wipe-plaid-tokens.mjs --confirm        # actually delete
 *   node scripts/wipe-plaid-tokens.mjs --table MyTable  # override table name
 *
 * Requires AWS credentials in .env (or AWS_PROFILE / ambient credentials).
 */
import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const args = process.argv.slice(2)
function flag(name) { return args.includes(`--${name}`) }
function opt(name) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null
}

const TABLE = opt('table') || process.env.TOKENS_TABLE || 'PlaidTokens'
const BUCKET = opt('bucket') || process.env.S3_BUCKET || 'rag-consulting-burndown'
const REGION = opt('region') || process.env.AWS_REGION || process.env.S3_REGION || 'us-west-1'
const CONFIRM = flag('confirm')

const dynamo = new DynamoDBClient({ region: REGION })
const s3 = new S3Client({ region: REGION })

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

async function deleteAccountsCaches() {
  let deleted = 0
  let continuationToken
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'orgs/',
      ContinuationToken: continuationToken,
    }))
    for (const obj of (res.Contents || [])) {
      if (obj.Key.endsWith('/accounts-cache.json')) {
        if (CONFIRM) {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }))
        }
        deleted++
        console.log(`  ${CONFIRM ? 'Deleted' : 'Would delete'} s3://${BUCKET}/${obj.Key}`)
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return deleted
}

async function main() {
  console.log(`\nTable:  ${TABLE}`)
  console.log(`Bucket: ${BUCKET}`)
  console.log(`Region: ${REGION}`)
  console.log(`Mode:   ${CONFIRM ? 'DELETE (for real!)' : 'DRY RUN (pass --confirm to delete)'}\n`)

  // 1. Scan all Plaid token items
  const items = await scanAllItems()
  console.log(`Found ${items.length} Plaid token(s) in DynamoDB:\n`)

  for (const item of items) {
    const userId = item.userId?.S || '?'
    const itemId = item.itemId?.S || '?'
    const institution = item.institutionName?.S || 'unknown'
    const token = item.accessToken?.S || ''
    const looksValid = /^access-(sandbox|development|production)-/.test(token)

    console.log(`  ${userId} / ${itemId} — ${institution} [token: ${looksValid ? 'plaintext' : 'encrypted/corrupt'}]`)

    if (CONFIRM) {
      await dynamo.send(new DeleteItemCommand({
        TableName: TABLE,
        Key: {
          userId: { S: userId },
          itemId: { S: itemId },
        },
      }))
      console.log(`    → Deleted`)
    }
  }

  // 2. Clear accounts caches from S3
  console.log(`\nAccounts caches in S3:`)
  const cacheCount = await deleteAccountsCaches()

  console.log(`\n${CONFIRM ? 'Done!' : 'Dry run complete.'} ${items.length} token(s), ${cacheCount} cache(s) ${CONFIRM ? 'deleted' : 'would be deleted'}.`)

  if (!CONFIRM) {
    console.log(`\nRe-run with --confirm to actually delete.\n`)
  } else {
    console.log(`\nUsers will need to reconnect their bank accounts via Plaid Link.\n`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
