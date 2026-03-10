import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient, PutCommand, GetCommand, BatchGetCommand, UpdateCommand, DeleteCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.USERS_TABLE || 'BurndownUsers'

let _doc = null
function doc() {
  if (_doc) return _doc
  _doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return _doc
}

export async function createUser({ userId, email, passwordHash, phoneNumber, inviteToken }) {
  const item = {
    userId,
    email: email.toLowerCase(),
    passwordHash,
    mfaEnabled: false,
    mfaSecret: null,
    phoneNumber: phoneNumber || null,
    phoneVerified: false,
    mfaMethod: null,
    tier: 'free',
    inviteToken: inviteToken || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await doc().send(new PutCommand({
    TableName: TABLE,
    Item: item,
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

export async function getUsers(userIds) {
  if (!userIds || userIds.length === 0) return []

  const unique = [...new Set(userIds)]
  const results = []

  // BatchGetItem supports up to 100 keys per call
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100)
    const res = await doc().send(new BatchGetCommand({
      RequestItems: {
        [TABLE]: {
          Keys: batch.map(userId => ({ userId })),
        },
      },
    }))

    if (res.Responses?.[TABLE]) {
      results.push(...res.Responses[TABLE])
    }

    // Handle unprocessed keys (DynamoDB throughput limits)
    let unprocessed = res.UnprocessedKeys?.[TABLE]
    while (unprocessed?.Keys?.length) {
      const retry = await doc().send(new BatchGetCommand({
        RequestItems: { [TABLE]: unprocessed },
      }))
      if (retry.Responses?.[TABLE]) {
        results.push(...retry.Responses[TABLE])
      }
      unprocessed = retry.UnprocessedKeys?.[TABLE]
    }
  }

  return results
}

export async function getUserByEmail(email) {
  // For simplicity, userId is the email. Direct lookup.
  return getUser(email.toLowerCase())
}

export async function getUserByResetTokenHash(tokenHash) {
  const res = await doc().send(new ScanCommand({
    TableName: TABLE,
    FilterExpression: 'resetTokenHash = :h',
    ExpressionAttributeValues: { ':h': tokenHash },
    Limit: 1,
  }))
  return res.Items?.[0] || null
}

export async function setPendingMfaSecret(userId, pendingMfaSecret) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET pendingMfaSecret = :s, pendingMfaExpiry = :e, updatedAt = :u',
    ExpressionAttributeValues: {
      ':s': pendingMfaSecret,
      ':e': Date.now() + 10 * 60 * 1000, // 10 minute expiry
      ':u': new Date().toISOString(),
    },
  }))
}

export async function enableMfa(userId, mfaSecret) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET mfaEnabled = :t, mfaSecret = :s, pendingMfaSecret = :n, pendingMfaExpiry = :n2, updatedAt = :u',
    ExpressionAttributeValues: {
      ':t': true,
      ':s': mfaSecret,
      ':n': null,
      ':n2': null,
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

export async function updateUserTier(userId, tier) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET tier = :t, updatedAt = :u',
    ExpressionAttributeValues: {
      ':t': tier,
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

export async function setResetToken(userId, resetTokenHash, resetTokenExpiry) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET resetTokenHash = :h, resetTokenExpiry = :e, updatedAt = :u',
    ExpressionAttributeValues: {
      ':h': resetTokenHash,
      ':e': resetTokenExpiry,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function clearResetToken(userId) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET resetTokenHash = :n, resetTokenExpiry = :n2, updatedAt = :u',
    ExpressionAttributeValues: {
      ':n': null,
      ':n2': null,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function updatePassword(userId, passwordHash) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET passwordHash = :ph, resetTokenHash = :n, resetTokenExpiry = :n2, updatedAt = :u',
    ExpressionAttributeValues: {
      ':ph': passwordHash,
      ':n': null,
      ':n2': null,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function updateUserPhone(userId, phoneNumber, phoneVerified) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET phoneNumber = :pn, phoneVerified = :pv, updatedAt = :u',
    ExpressionAttributeValues: {
      ':pn': phoneNumber,
      ':pv': phoneVerified,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function setPhoneOtp(userId, otpHash, otpExpiry, pendingPhone) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET phoneOtpHash = :h, phoneOtpExpiry = :e, phoneOtpAttempts = :a, pendingPhone = :pp, updatedAt = :u',
    ExpressionAttributeValues: {
      ':h': otpHash,
      ':e': otpExpiry,
      ':a': 0,
      ':pp': pendingPhone,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function clearPhoneOtp(userId) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET phoneOtpHash = :n, phoneOtpExpiry = :n2, phoneOtpAttempts = :n3, pendingPhone = :n4, updatedAt = :u',
    ExpressionAttributeValues: {
      ':n': null,
      ':n2': null,
      ':n3': null,
      ':n4': null,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function incrementOtpAttempts(userId) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET phoneOtpAttempts = if_not_exists(phoneOtpAttempts, :zero) + :one',
    ExpressionAttributeValues: {
      ':zero': 0,
      ':one': 1,
    },
  }))
}

export async function incrementLoginAttempts(userId, lockoutUntil) {
  const updates = [
    'failedLoginAttempts = if_not_exists(failedLoginAttempts, :zero) + :one',
    'lastFailedLoginAt = :now',
    'updatedAt = :u',
  ]
  const values = {
    ':zero': 0,
    ':one': 1,
    ':now': new Date().toISOString(),
    ':u': new Date().toISOString(),
  }

  if (lockoutUntil) {
    updates.push('accountLockedUntil = :lock')
    values[':lock'] = lockoutUntil
  }

  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: values,
  }))
}

export async function clearLoginAttempts(userId) {
  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: 'SET failedLoginAttempts = :zero, accountLockedUntil = :n, lastFailedLoginAt = :n2, updatedAt = :u',
    ExpressionAttributeValues: {
      ':zero': 0,
      ':n': null,
      ':n2': null,
      ':u': new Date().toISOString(),
    },
  }))
}

export async function setPhoneVerified(userId, pendingPhone) {
  const updates = [
    'phoneVerified = :t',
    'mfaEnabled = :t',
    'mfaMethod = :m',
    'phoneOtpHash = :n',
    'phoneOtpExpiry = :n2',
    'phoneOtpAttempts = :n3',
    'pendingPhone = :n4',
    'updatedAt = :u',
  ]
  const values = {
    ':t': true,
    ':m': 'sms',
    ':n': null,
    ':n2': null,
    ':n3': null,
    ':n4': null,
    ':u': new Date().toISOString(),
  }

  if (pendingPhone) {
    updates.push('phoneNumber = :pn')
    values[':pn'] = pendingPhone
  }

  await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: values,
  }))
}

export async function deleteUser(userId) {
  await doc().send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId },
  }))
}

export async function listAllUsers({ limit, exclusiveStartKey } = {}) {
  const params = {
    TableName: TABLE,
    ProjectionExpression: 'userId, email, orgId, orgRole, mfaEnabled, tier, createdAt, updatedAt',
  }
  if (limit) params.Limit = limit
  if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey

  const res = await doc().send(new ScanCommand(params))
  return { items: res.Items || [], lastEvaluatedKey: res.LastEvaluatedKey }
}
