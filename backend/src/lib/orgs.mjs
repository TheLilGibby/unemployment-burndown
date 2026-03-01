import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import crypto from 'node:crypto'

const TABLE = process.env.ORGS_TABLE || 'Organizations'

let _doc = null
function doc() {
  if (_doc) return _doc
  _doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return _doc
}

function generateOrgId() { return `org_${crypto.randomBytes(8).toString('hex')}` }
function generateJoinCode() { return crypto.randomBytes(4).toString('hex').toUpperCase() }

export async function createOrg({ name, ownerId }) {
  const orgId = generateOrgId()
  const joinCode = generateJoinCode()
  const now = new Date().toISOString()

  await doc().send(new PutCommand({
    TableName: TABLE,
    Item: { orgId, name, joinCode, ownerId, createdAt: now, updatedAt: now },
  }))

  return { orgId, joinCode }
}

export async function getOrg(orgId) {
  const res = await doc().send(new GetCommand({
    TableName: TABLE,
    Key: { orgId },
  }))
  return res.Item || null
}

export async function getOrgByJoinCode(joinCode) {
  const res = await doc().send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'joinCode-index',
    KeyConditionExpression: 'joinCode = :jc',
    ExpressionAttributeValues: { ':jc': joinCode },
  }))
  return (res.Items && res.Items[0]) || null
}

export async function regenerateJoinCode(orgId) {
  const newCode = generateJoinCode()
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { orgId },
    UpdateExpression: 'SET joinCode = :jc, updatedAt = :u',
    ExpressionAttributeValues: {
      ':jc': newCode,
      ':u': new Date().toISOString(),
    },
  }))
  return newCode
}
