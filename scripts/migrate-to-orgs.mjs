#!/usr/bin/env node

/**
 * One-time migration script: move data from root to org-scoped S3 paths.
 *
 * Steps:
 * 1. Read existing data.json from S3 root
 * 2. Find oldest registered user → assign as org owner
 * 3. Create org in DynamoDB (generate orgId + joinCode)
 * 4. Copy data.json → orgs/{orgId}/data.json (update people with linkedUserId)
 * 5. Copy statements/* → orgs/{orgId}/statements/*
 * 6. Create OrgMembers entries for all existing users
 * 7. Update Users table with orgId/orgRole
 * 8. Migrate PlaidTokens: re-key from userId='default' to userId=orgId
 * 9. Keep original data.json as backup
 *
 * Usage:
 *   node scripts/migrate-to-orgs.mjs
 *
 * Environment variables:
 *   AWS_REGION, S3_BUCKET, USERS_TABLE, ORGS_TABLE, ORG_MEMBERS_TABLE, TOKENS_TABLE
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand,
  QueryCommand, DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import crypto from 'node:crypto'

// ── Config ──
const REGION        = process.env.AWS_REGION || 'us-west-1'
const S3_BUCKET     = process.env.S3_BUCKET || 'rag-consulting-burndown'
const USERS_TABLE   = process.env.USERS_TABLE || 'BurndownUsers'
const ORGS_TABLE    = process.env.ORGS_TABLE || 'Organizations'
const MEMBERS_TABLE = process.env.ORG_MEMBERS_TABLE || 'OrgMembers'
const TOKENS_TABLE  = process.env.TOKENS_TABLE || 'PlaidTokens'

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }))
const s3     = new S3Client({ region: REGION })

function generateOrgId() { return `org_${crypto.randomBytes(8).toString('hex')}` }
function generateJoinCode() { return crypto.randomBytes(4).toString('hex').toUpperCase() }

async function s3Get(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    return JSON.parse(await res.Body.transformToString('utf-8'))
  } catch (e) {
    if (e.name === 'NoSuchKey') return null
    throw e
  }
}

async function s3Put(key, data) {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }))
}

async function main() {
  console.log('=== Migration: Root data → Org-scoped data ===\n')

  // 1. Read existing data.json
  console.log('1. Reading root data.json...')
  const data = await s3Get('data.json')
  if (!data) {
    console.log('   No data.json found at root. Nothing to migrate.')
    return
  }
  console.log('   Found data.json with', (data.state?.people || []).length, 'people')

  // 2. Find all registered users
  console.log('2. Scanning users table...')
  const usersRes = await dynamo.send(new ScanCommand({ TableName: USERS_TABLE }))
  const allUsers = usersRes.Items || []
  console.log('   Found', allUsers.length, 'registered users')

  if (allUsers.length === 0) {
    console.log('   No users found. Cannot create org owner. Aborting.')
    return
  }

  // Find oldest user (by createdAt)
  const sortedUsers = [...allUsers].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  const owner = sortedUsers[0]
  console.log('   Org owner:', owner.email, '(created', owner.createdAt, ')')

  // 3. Create org
  console.log('3. Creating organization...')
  const orgId = generateOrgId()
  const joinCode = generateJoinCode()
  const now = new Date().toISOString()

  await dynamo.send(new PutCommand({
    TableName: ORGS_TABLE,
    Item: { orgId, name: 'My Household', joinCode, ownerId: owner.userId, createdAt: now, updatedAt: now },
  }))
  console.log('   Created org:', orgId, '(join code:', joinCode, ')')

  // 4. Copy data.json → orgs/{orgId}/data.json
  console.log('4. Copying data.json to org-scoped path...')

  // Update people with linkedUserId for matching users
  if (data.state?.people) {
    for (const person of data.state.people) {
      // Try matching by email
      const matchingUser = allUsers.find(u =>
        u.email && person.name &&
        (u.email.toLowerCase().includes(person.name.toLowerCase()) ||
         person.name.toLowerCase().includes(u.email.split('@')[0].toLowerCase()))
      )
      if (matchingUser) {
        person.linkedUserId = matchingUser.userId
        person.email = matchingUser.email
        console.log('   Linked person "' + person.name + '" to user', matchingUser.email)
      }
    }
  }

  data.savedAt = now
  await s3Put(`orgs/${orgId}/data.json`, data)
  console.log('   Copied to orgs/' + orgId + '/data.json')

  // 5. Copy statements
  console.log('5. Copying statements...')
  const listRes = await s3.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: 'statements/',
  }))
  const stmtKeys = (listRes.Contents || []).map(o => o.Key).filter(Boolean)
  for (const key of stmtKeys) {
    const newKey = `orgs/${orgId}/${key}`
    await s3.send(new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${key}`,
      Key: newKey,
    }))
    console.log('   Copied', key, '→', newKey)
  }

  // 6. Create OrgMembers entries
  console.log('6. Creating org member entries...')
  for (const user of allUsers) {
    const role = user.userId === owner.userId ? 'owner' : 'member'
    await dynamo.send(new PutCommand({
      TableName: MEMBERS_TABLE,
      Item: { orgId, userId: user.userId, role, joinedAt: now },
    }))
    console.log('   Added', user.email, 'as', role)
  }

  // 7. Update Users table with orgId/orgRole
  console.log('7. Updating users with org info...')
  for (const user of allUsers) {
    const role = user.userId === owner.userId ? 'owner' : 'member'
    await dynamo.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: user.userId },
      UpdateExpression: 'SET orgId = :oid, orgRole = :role, updatedAt = :u',
      ExpressionAttributeValues: { ':oid': orgId, ':role': role, ':u': now },
    }))
    console.log('   Updated', user.email, '→ orgId:', orgId, 'role:', role)
  }

  // 8. Migrate PlaidTokens: re-key from userId='default' to userId=orgId
  console.log('8. Migrating Plaid tokens...')
  const tokensRes = await dynamo.send(new QueryCommand({
    TableName: TOKENS_TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': 'default' },
  }))
  const tokens = tokensRes.Items || []
  for (const token of tokens) {
    // Create new record with orgId as userId
    await dynamo.send(new PutCommand({
      TableName: TOKENS_TABLE,
      Item: { ...token, userId: orgId },
    }))
    // Delete old record
    await dynamo.send(new DeleteCommand({
      TableName: TOKENS_TABLE,
      Key: { userId: 'default', itemId: token.itemId },
    }))
    console.log('   Re-keyed token for item', token.itemId, 'default →', orgId)
  }

  // 9. Keep original data.json as backup (it stays in place)
  console.log('\n9. Original data.json left as backup at root.\n')

  console.log('=== Migration complete! ===')
  console.log('Org ID:', orgId)
  console.log('Join code:', joinCode)
  console.log('Owner:', owner.email)
  console.log('Members:', allUsers.length)
  console.log('Plaid tokens migrated:', tokens.length)
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
