#!/usr/bin/env node
/**
 * One-off migration: Update Jon's email from test@test.com to goragconsulting@gmail.com
 * in the production data for org_039210db04aadec1.
 *
 * Usage:
 *   node scripts/migrate-jon-email.mjs
 *
 * Requires AWS credentials (via .env, AWS_PROFILE, or ambient credentials).
 */
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const BUCKET = process.env.S3_BUCKET || 'rag-consulting-burndown'
const REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-west-1'
const ORG_ID = 'org_039210db04aadec1'
const KEY = `orgs/${ORG_ID}/data.json`

const OLD_EMAIL = 'test@test.com'
const NEW_EMAIL = 'goragconsulting@gmail.com'

const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    : undefined,
})

async function main() {
  console.log(`Reading s3://${BUCKET}/${KEY} ...`)
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }))
  const data = JSON.parse(await res.Body.transformToString('utf-8'))

  const people = data.state?.people || []
  const jon = people.find(p => p.id === 2 && p.name === 'Jon')

  if (!jon) {
    console.error('Could not find person with id=2 and name="Jon"')
    process.exit(1)
  }

  console.log(`Found Jon (id=${jon.id}):`)
  console.log(`  email:        ${jon.email}`)
  console.log(`  linkedUserId: ${jon.linkedUserId}`)

  if (jon.email !== OLD_EMAIL && jon.linkedUserId !== OLD_EMAIL) {
    console.log('Nothing to update — email is already changed.')
    process.exit(0)
  }

  jon.email = NEW_EMAIL
  jon.linkedUserId = NEW_EMAIL

  console.log(`\nUpdating to:`)
  console.log(`  email:        ${jon.email}`)
  console.log(`  linkedUserId: ${jon.linkedUserId}`)

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }))

  console.log(`\nWritten back to s3://${BUCKET}/${KEY}`)
  console.log('Done!')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
