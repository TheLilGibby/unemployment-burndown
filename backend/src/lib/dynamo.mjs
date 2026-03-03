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

function encryptToken(token) {
  if (!token || !isEncryptionConfigured()) return token
  return encrypt(token)
}

function decryptToken(token) {
  if (!token || !isEncryptionConfigured()) return token
  try {
    return decrypt(token)
  } catch {
    // Token may not yet be encrypted (pre-migration); return as-is
    return token
  }
}

function decryptItem(item) {
  if (!item) return item
  return { ...item, accessToken: decryptToken(item.accessToken) }
}

/**
 * Store a Plaid item (access_token encrypted at-rest + metadata).
 */
export async function putPlaidItem({ userId, itemId, accessToken, institutionId, institutionName, cursor, connectedBy }) {
  await getDocClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      userId,
      itemId,
      accessToken: encryptToken(accessToken),
      institutionId:   institutionId || null,
      institutionName: institutionName || null,
      cursor:          cursor || null,
      connectedBy:     connectedBy || null,
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    },
  }))
}

/**
 * Get a single Plaid item by userId + itemId.
 */
export async function getPlaidItem(userId, itemId) {
  const res = await getDocClient().send(new GetCommand({
    TableName: TABLE,
    Key: { userId, itemId },
  }))
  return decryptItem(res.Item) || null
}

/**
 * Get all Plaid items for a user.
 */
export async function getPlaidItemsByUser(userId) {
  const res = await getDocClient().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }))
  return (res.Items || []).map(decryptItem)
}

/**
 * Update the sync cursor for an item.
 */
export async function updateCursor(userId, itemId, cursor) {
  const existing = await getPlaidItem(userId, itemId)
  await getDocClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...existing,
      accessToken: encryptToken(existing.accessToken),
      cursor,
      updatedAt: new Date().toISOString(),
    },
  }))
}

/**
 * Delete a Plaid item.
 */
export async function deletePlaidItem(userId, itemId) {
  await getDocClient().send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId, itemId },
  }))
}
