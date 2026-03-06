#!/usr/bin/env node
/**
 * One-off migration: Link goragconsulting@gmail.com to org_039210db04aadec1
 *
 * Updates:
 *   1. BurndownUsers — sets orgId + orgRole on the user record
 *   2. OrgMembers    — adds a membership row linking user to org with personId=2 (Jon)
 *   3. S3 data.json  — sets linkedUserId + email on person id=2 so the account
 *                      is properly associated with this user in the household data
 *
 * Usage:
 *   node scripts/link-user-to-org.mjs
 *
 * Requires AWS credentials (via .env, AWS_PROFILE, or ambient credentials).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'node:crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const REGION = process.env.AWS_REGION || 'us-west-1'
const USERS_TABLE = process.env.USERS_TABLE || 'BurndownUsers'
const ORGS_TABLE = process.env.ORGS_TABLE || 'Organizations'
const ORG_MEMBERS_TABLE = process.env.ORG_MEMBERS_TABLE || 'OrgMembers'
const S3_BUCKET = process.env.S3_BUCKET || 'rag-consulting-burndown'
const S3_REGION = process.env.S3_REGION || REGION

const USER_ID = 'goragconsulting@gmail.com'
const ORG_ID = 'org_039210db04aadec1'
const ORG_NAME = 'My Household'
const PERSON_ID = 2 // Jon's id in data.json

const credentials = process.env.AWS_ACCESS_KEY_ID
  ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
  : undefined

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION, credentials }))
const s3 = new S3Client({ region: S3_REGION, credentials })

async function main() {
  // 1. Verify user exists
  console.log(`Checking ${USERS_TABLE} for ${USER_ID}...`)
  const userRes = await dynamo.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId: USER_ID },
  }))
  if (!userRes.Item) {
    console.error(`User ${USER_ID} not found in ${USERS_TABLE}`)
    process.exit(1)
  }
  console.log(`  Found user. Current orgId: ${userRes.Item.orgId || '(none)'}`)

  // 2. Ensure org exists — create it if missing
  console.log(`\nChecking ${ORGS_TABLE} for ${ORG_ID}...`)
  const orgRes = await dynamo.send(new GetCommand({
    TableName: ORGS_TABLE,
    Key: { orgId: ORG_ID },
  }))

  let orgRole
  const now = new Date().toISOString()

  if (!orgRes.Item) {
    console.log(`  Org not found — creating it now as owner...`)
    const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase()
    await dynamo.send(new PutCommand({
      TableName: ORGS_TABLE,
      Item: { orgId: ORG_ID, name: ORG_NAME, joinCode, ownerId: USER_ID, createdAt: now, updatedAt: now },
    }))
    console.log(`  Created org "${ORG_NAME}" (joinCode: ${joinCode})`)
    orgRole = 'owner'
  } else {
    console.log(`  Found org: "${orgRes.Item.name}"`)
    // If this user is already recorded as the owner, honour that; otherwise join as member
    orgRole = orgRes.Item.ownerId === USER_ID ? 'owner' : 'member'
  }

  // 3. Update BurndownUsers — set orgId and orgRole
  console.log(`\nUpdating ${USERS_TABLE}: orgId=${ORG_ID}, orgRole=${orgRole}`)
  await dynamo.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId: USER_ID },
    UpdateExpression: 'SET orgId = :oid, orgRole = :role, updatedAt = :u',
    ExpressionAttributeValues: {
      ':oid': ORG_ID,
      ':role': orgRole,
      ':u': now,
    },
  }))
  console.log('  Done.')

  // 4. Add to OrgMembers
  console.log(`\nAdding to ${ORG_MEMBERS_TABLE}: orgId=${ORG_ID}, userId=${USER_ID}, role=${orgRole}, personId=${PERSON_ID}`)
  await dynamo.send(new PutCommand({
    TableName: ORG_MEMBERS_TABLE,
    Item: {
      orgId: ORG_ID,
      userId: USER_ID,
      role: orgRole,
      personId: PERSON_ID,
      joinedAt: now,
    },
  }))
  console.log('  Done.')

  // 5. Update data.json — link person id=PERSON_ID to this user
  const dataKey = `orgs/${ORG_ID}/data.json`
  console.log(`\nUpdating s3://${S3_BUCKET}/${dataKey}: setting linkedUserId on person id=${PERSON_ID}...`)
  let data
  try {
    const s3Res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: dataKey }))
    data = JSON.parse(await s3Res.Body.transformToString('utf-8'))
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
      console.warn(`  data.json not found at ${dataKey} — skipping S3 update.`)
      console.log('\nUser linked in DynamoDB. Log out and log back in to pick up the new org membership.')
      return
    }
    throw e
  }

  const person = (data.state?.people || []).find(p => p.id === PERSON_ID)
  if (!person) {
    console.warn(`  Person with id=${PERSON_ID} not found in data.json — skipping S3 update.`)
  } else {
    console.log(`  Found person: "${person.name}" (current linkedUserId: ${person.linkedUserId || '(none)'})`)
    if (person.linkedUserId === USER_ID && person.email === USER_ID) {
      console.log('  Already linked correctly — no S3 update needed.')
    } else {
      person.linkedUserId = USER_ID
      person.email = USER_ID
      data.savedAt = new Date().toISOString()
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: dataKey,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      }))
      console.log(`  Updated person "${person.name}": linkedUserId + email → ${USER_ID}`)
    }
  }

  console.log('\nUser linked successfully! Log out and log back in to pick up the new org membership.')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
