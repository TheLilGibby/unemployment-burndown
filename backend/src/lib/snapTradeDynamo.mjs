import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { encrypt, decrypt, isEncryptionConfigured } from './encryption.mjs'

const TABLE = process.env.TOKENS_TABLE || 'PlaidTokens'

let _docClient = null

function getDocClient() {
  if (_docClient) return _docClient
  const client = new DynamoDBClient({})
  _docClient = DynamoDBDocumentClient.from(client)
  return _docClient
}

function encryptSecret(secret) {
  if (!secret || !isEncryptionConfigured()) return secret
  return encrypt(secret)
}

function decryptSecret(secret) {
  if (!secret || !isEncryptionConfigured()) return secret
  try {
    return decrypt(secret)
  } catch {
    return secret
  }
}

// ── SnapTrade User Registration ──

export async function putSnapTradeUser({ userId, snapTradeUserId, userSecret }) {
  await getDocClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      userId,
      itemId: 'st_user',
      snapTradeUserId,
      userSecret: encryptSecret(userSecret),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }))
}

export async function getSnapTradeUser(userId) {
  const res = await getDocClient().send(new GetCommand({
    TableName: TABLE,
    Key: { userId, itemId: 'st_user' },
  }))
  if (!res.Item) return null
  return { ...res.Item, userSecret: decryptSecret(res.Item.userSecret) }
}

export async function deleteSnapTradeUser(userId) {
  await getDocClient().send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId, itemId: 'st_user' },
  }))
}

// ── SnapTrade Connections ──

export async function putSnapTradeConnection({ userId, connectionId, brokerageName }) {
  await getDocClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      userId,
      itemId: `st_conn_${connectionId}`,
      connectionId,
      brokerageName: brokerageName || 'Connected Brokerage',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }))
}

export async function getSnapTradeConnection(userId, connectionId) {
  const res = await getDocClient().send(new GetCommand({
    TableName: TABLE,
    Key: { userId, itemId: `st_conn_${connectionId}` },
  }))
  return res.Item || null
}

export async function getSnapTradeConnectionsByUser(userId) {
  const res = await getDocClient().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid AND begins_with(itemId, :prefix)',
    ExpressionAttributeValues: { ':uid': userId, ':prefix': 'st_conn_' },
  }))
  return res.Items || []
}

export async function deleteSnapTradeConnection(userId, connectionId) {
  await getDocClient().send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId, itemId: `st_conn_${connectionId}` },
  }))
}
