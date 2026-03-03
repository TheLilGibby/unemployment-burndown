#!/usr/bin/env node
/**
 * One-off migration: Link goragconsulting@gmail.com to org_039210db04aadec1
 *
 * Updates:
 *   1. BurndownUsers — sets orgId + orgRole on the user record
 *   2. OrgMembers    — adds a membership row linking user to org with personId=2 (Jon)
 *
 * Usage:
 *   node scripts/link-user-to-org.mjs
 *
 * Requires AWS credentials (via .env, AWS_PROFILE, or ambient credentials).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env') })

const REGION = process.env.AWS_REGION || 'us-west-1'
const USERS_TABLE = process.env.USERS_TABLE || 'BurndownUsers'
const ORG_MEMBERS_TABLE = process.env.ORG_MEMBERS_TABLE || 'OrgMembers'

const USER_ID = 'goragconsulting@gmail.com'
const ORG_ID = 'org_039210db04aadec1'
const ORG_ROLE = 'member'
const PERSON_ID = 2 // Jon's id in data.json

const client = new DynamoDBClient({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
    : undefined,
})
const doc = DynamoDBDocumentClient.from(client)

async function main() {
  // 1. Verify user exists
  console.log(`Checking ${USERS_TABLE} for ${USER_ID}...`)
  const userRes = await doc.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId: USER_ID },
  }))
  if (!userRes.Item) {
    console.error(`User ${USER_ID} not found in ${USERS_TABLE}`)
    process.exit(1)
  }
  console.log(`  Found user. Current orgId: ${userRes.Item.orgId || '(none)'}`)

  // 2. Update BurndownUsers — set orgId and orgRole
  console.log(`\nUpdating ${USERS_TABLE}: orgId=${ORG_ID}, orgRole=${ORG_ROLE}`)
  await doc.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId: USER_ID },
    UpdateExpression: 'SET orgId = :oid, orgRole = :role, updatedAt = :u',
    ExpressionAttributeValues: {
      ':oid': ORG_ID,
      ':role': ORG_ROLE,
      ':u': new Date().toISOString(),
    },
  }))
  console.log('  Done.')

  // 3. Add to OrgMembers
  console.log(`\nAdding to ${ORG_MEMBERS_TABLE}: orgId=${ORG_ID}, userId=${USER_ID}, role=${ORG_ROLE}, personId=${PERSON_ID}`)
  await doc.send(new PutCommand({
    TableName: ORG_MEMBERS_TABLE,
    Item: {
      orgId: ORG_ID,
      userId: USER_ID,
      role: ORG_ROLE,
      personId: PERSON_ID,
      joinedAt: new Date().toISOString(),
    },
  }))
  console.log('  Done.')

  console.log('\nUser linked successfully! Log out and log back in to pick up the new org membership.')
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
