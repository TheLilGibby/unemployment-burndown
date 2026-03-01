#!/usr/bin/env node
/**
 * Pull production data from S3 into local examples/ directory.
 *
 * Usage:
 *   node scripts/pull-prod-examples.mjs                     # uses default org (reads from root data.json)
 *   node scripts/pull-prod-examples.mjs --org <orgId>       # pulls a specific org's data
 *   node scripts/pull-prod-examples.mjs --bucket <bucket>   # override S3 bucket name
 *   node scripts/pull-prod-examples.mjs --sanitize          # strip PII (names, emails, plaid tokens)
 *
 * Requires AWS credentials in .env (or AWS_PROFILE / ambient credentials).
 */
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const EXAMPLES_DIR = resolve(ROOT, 'examples')

// Load .env from project root
dotenv.config({ path: resolve(ROOT, '.env') })

// ── CLI args ──
const args = process.argv.slice(2)
function flag(name) { return args.includes(`--${name}`) }
function opt(name) {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null
}

const ORG_ID = opt('org') || null
const BUCKET = opt('bucket') || process.env.S3_BUCKET || 'rag-consulting-burndown'
const SANITIZE = flag('sanitize')

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    : undefined, // falls back to ambient / profile credentials
})

async function s3Get(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    return JSON.parse(await res.Body.transformToString('utf-8'))
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null
    throw e
  }
}

async function s3List(prefix) {
  const keys = []
  let token = undefined
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }))
    for (const obj of res.Contents || []) keys.push(obj.Key)
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return keys
}

// ── Sanitize PII ──
function sanitize(data) {
  if (!data) return data
  const clone = JSON.parse(JSON.stringify(data))

  if (clone.state) {
    // Anonymize people
    if (clone.state.people) {
      clone.state.people.forEach((p, i) => {
        p.name = `Person ${i + 1}`
        if (p.email) p.email = `person${i + 1}@example.com`
        if (p.linkedUserId) p.linkedUserId = `user_${i + 1}`
      })
    }
    // Redact plaid account IDs
    if (clone.state.savingsAccounts) {
      clone.state.savingsAccounts.forEach(a => {
        if (a.plaidAccountId) a.plaidAccountId = `example_acct_${a.id}`
      })
    }
    if (clone.state.creditCards) {
      clone.state.creditCards.forEach(c => {
        if (c.plaidAccountId) c.plaidAccountId = `example_acct_${c.id}`
      })
    }
  }

  return clone
}

function sanitizeStatement(stmt) {
  if (!stmt) return stmt
  const clone = JSON.parse(JSON.stringify(stmt))
  if (clone.plaidAccountId) clone.plaidAccountId = `example_acct_${clone.cardId || 'unknown'}`
  if (clone.transactions) {
    clone.transactions.forEach(t => {
      if (t.plaidTransactionId) t.plaidTransactionId = `example_txn_${t.id}`
    })
  }
  return clone
}

// ── Main ──
async function main() {
  console.log(`Pulling from s3://${BUCKET}`)
  console.log(`Org: ${ORG_ID || '(root)'}`)
  console.log(`Sanitize: ${SANITIZE}`)
  console.log(`Output: ${EXAMPLES_DIR}/`)
  console.log()

  // Ensure output dirs exist
  mkdirSync(resolve(EXAMPLES_DIR, 'statements'), { recursive: true })

  // 1. Pull data.json
  const dataKey = ORG_ID ? `orgs/${ORG_ID}/data.json` : 'data.json'
  console.log(`Fetching ${dataKey}...`)
  let data = await s3Get(dataKey)
  if (!data) {
    console.error(`No data found at ${dataKey}`)
    process.exit(1)
  }
  if (SANITIZE) data = sanitize(data)
  writeFileSync(resolve(EXAMPLES_DIR, 'data.json'), JSON.stringify(data, null, 2))
  console.log(`  -> examples/data.json (${JSON.stringify(data).length} bytes)`)

  // 2. Pull statements index
  const indexKey = ORG_ID ? `orgs/${ORG_ID}/statements/index.json` : 'statements/index.json'
  console.log(`Fetching ${indexKey}...`)
  const index = await s3Get(indexKey)
  if (index) {
    writeFileSync(resolve(EXAMPLES_DIR, 'statements', 'index.json'), JSON.stringify(index, null, 2))
    console.log(`  -> examples/statements/index.json (${index.statements?.length || 0} entries)`)

    // 3. Pull individual statements
    for (const entry of index.statements || []) {
      const stmtKey = ORG_ID ? `orgs/${ORG_ID}/statements/${entry.id}.json` : `statements/${entry.id}.json`
      console.log(`  Fetching ${entry.id}...`)
      let stmt = await s3Get(stmtKey)
      if (stmt) {
        if (SANITIZE) stmt = sanitizeStatement(stmt)
        writeFileSync(
          resolve(EXAMPLES_DIR, 'statements', `${entry.id}.json`),
          JSON.stringify(stmt, null, 2)
        )
        console.log(`    -> examples/statements/${entry.id}.json (${stmt.transactions?.length || 0} txns)`)
      }
    }
  } else {
    // Write empty index
    const emptyIndex = { version: 1, lastUpdated: null, statements: [] }
    writeFileSync(resolve(EXAMPLES_DIR, 'statements', 'index.json'), JSON.stringify(emptyIndex, null, 2))
    console.log('  -> examples/statements/index.json (empty — no statements in prod)')
  }

  console.log()
  console.log('Done! To use locally:')
  console.log('  1. Copy .env.local.example to .env.local (or add to .env):')
  console.log('     USE_LOCAL_DATA=true')
  console.log('  2. Run: npm run server')
  console.log()
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
