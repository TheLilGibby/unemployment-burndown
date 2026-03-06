import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
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

const ACCESS_TOKEN_RE = /^access-(sandbox|development|production)-[a-f0-9-]+$/

function decryptToken(token) {
  if (!token || !isEncryptionConfigured()) return token
  // Already a valid plaintext token (pre-encryption migration)
  if (ACCESS_TOKEN_RE.test(token)) return token
  try {
    return decrypt(token)
  } catch {
    // Decryption failed — token may be double-encrypted or the key changed.
    // Return as-is so the caller can surface a clear error rather than crash.
    console.warn('[plaid-tokens] decryptToken failed — token may be corrupted or the PLAID_ENCRYPTION_KEY may have changed')
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
 * Excludes SnapTrade items (itemId prefixed with 'st_') which share the same table.
 * Filtering is done in-process because DynamoDB FilterExpression cannot reference
 * sort key attributes — itemId is the sort key, so it must not appear in FilterExpression.
 */
export async function getPlaidItemsByUser(userId) {
  const res = await getDocClient().send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }))
  return (res.Items || [])
    .filter(item => !item.itemId?.startsWith('st_'))
    .map(decryptItem)
}

/**
 * Update the sync cursor for an item.
 *
 * Uses UpdateCommand to modify only the cursor field, avoiding a
 * read-modify-write cycle that would needlessly decrypt and re-encrypt
 * the access token (risking double-encryption if the key ever changes).
 */
export async function updateCursor(userId, itemId, cursor) {
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId, itemId },
    UpdateExpression: 'SET #cursor = :cursor, updatedAt = :now',
    ExpressionAttributeNames: { '#cursor': 'cursor' },
    ExpressionAttributeValues: {
      ':cursor': cursor,
      ':now': new Date().toISOString(),
    },
  }))
}

/**
 * Returns true if the token looks like a valid Plaid access token.
 */
export function isValidAccessToken(token) {
  return typeof token === 'string' && ACCESS_TOKEN_RE.test(token)
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
