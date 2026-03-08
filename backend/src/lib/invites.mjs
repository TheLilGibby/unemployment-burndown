import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import crypto from 'node:crypto'

const TABLE = process.env.INVITES_TABLE || 'HouseholdInvites'

let _doc = null
function doc() {
  if (_doc) return _doc
  _doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return _doc
}

function generateInviteId() { return `inv_${crypto.randomBytes(8).toString('hex')}` }
function generateInviteToken() { return crypto.randomBytes(32).toString('hex') }

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function createInvite({ orgId, email, invitedBy }) {
  const inviteId = generateInviteId()
  const inviteToken = generateInviteToken()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS).toISOString()

  await doc().send(new PutCommand({
    TableName: TABLE,
    Item: {
      inviteId,
      orgId,
      email: email.toLowerCase(),
      invitedBy,
      status: 'pending',
      inviteToken,
      createdAt: now,
      expiresAt,
    },
  }))

  return { inviteId, inviteToken, expiresAt }
}

export async function getInvite(inviteId) {
  const res = await doc().send(new GetCommand({
    TableName: TABLE,
    Key: { inviteId },
  }))
  return res.Item || null
}

export async function getInviteByToken(inviteToken) {
  const res = await doc().send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'inviteToken-index',
    KeyConditionExpression: 'inviteToken = :t',
    ExpressionAttributeValues: { ':t': inviteToken },
  }))
  return (res.Items && res.Items[0]) || null
}

export async function getInvitesByOrg(orgId, { limit, exclusiveStartKey } = {}) {
  const params = {
    TableName: TABLE,
    IndexName: 'orgId-index',
    KeyConditionExpression: 'orgId = :oid',
    ExpressionAttributeValues: { ':oid': orgId },
  }
  if (limit) params.Limit = limit
  if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey

  const res = await doc().send(new QueryCommand(params))
  return { items: res.Items || [], lastEvaluatedKey: res.LastEvaluatedKey }
}

export async function getInvitesByEmail(email) {
  const res = await doc().send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :e',
    ExpressionAttributeValues: { ':e': email.toLowerCase() },
  }))
  return res.Items || []
}

export async function updateInviteStatus(inviteId, status) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { inviteId },
    UpdateExpression: 'SET #s = :s, updatedAt = :u',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: {
      ':s': status,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function deleteInvite(inviteId) {
  await doc().send(new DeleteCommand({
    TableName: TABLE,
    Key: { inviteId },
  }))
}
