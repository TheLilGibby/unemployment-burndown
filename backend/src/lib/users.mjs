import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.USERS_TABLE || 'BurndownUsers'

let _doc = null
function doc() {
  if (_doc) return _doc
  _doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return _doc
}

export async function createUser({ userId, email, passwordHash }) {
  await doc().send(new PutCommand({
    TableName: TABLE,
    Item: {
      userId,
      email: email.toLowerCase(),
      passwordHash,
      mfaEnabled: false,
      mfaSecret: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ConditionExpression: 'attribute_not_exists(userId)',
  }))
}

export async function getUser(userId) {
  const res = await doc().send(new GetCommand({
    TableName: TABLE,
    Key: { userId },
  }))
  return res.Item || null
}

export async function getUserByEmail(email) {
  // For simplicity, userId is the email. Direct lookup.
  return getUser(email.toLowerCase())
}

export async function enableMfa(userId, mfaSecret) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET mfaEnabled = :t, mfaSecret = :s, updatedAt = :u',
    ExpressionAttributeValues: {
      ':t': true,
      ':s': mfaSecret,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function disableMfa(userId) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET mfaEnabled = :f, mfaSecret = :n, updatedAt = :u',
    ExpressionAttributeValues: {
      ':f': false,
      ':n': null,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function updateUserOrg(userId, orgId, orgRole) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET orgId = :oid, orgRole = :role, updatedAt = :u',
    ExpressionAttributeValues: {
      ':oid': orgId,
      ':role': orgRole,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function updateUserProfile(userId, { profileColor, avatarDataUrl } = {}) {
  const updates = []
  const vals = { ':u': new Date().toISOString() }

  if (profileColor !== undefined) {
    updates.push('profileColor = :pc')
    vals[':pc'] = profileColor
  }
  if (avatarDataUrl !== undefined) {
    updates.push('avatarDataUrl = :av')
    vals[':av'] = avatarDataUrl
  }

  if (updates.length === 0) return

  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: `SET ${updates.join(', ')}, updatedAt = :u`,
    ExpressionAttributeValues: vals,
  }))
}

export async function deleteUser(userId) {
  await doc().send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId },
  }))
}

export async function listAllUsers() {
  const res = await doc().send(new ScanCommand({
    TableName: TABLE,
    ProjectionExpression: 'userId, email, orgId, orgRole, mfaEnabled, createdAt, updatedAt',
  }))
  return res.Items || []
}
