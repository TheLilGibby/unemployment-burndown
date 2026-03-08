import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.S3_BUCKET || 'rag-consulting-burndown'
const REGION = process.env.S3_REGION || 'us-west-1'

let _s3 = null

function getS3() {
  if (_s3) return _s3
  _s3 = new S3Client({ region: REGION })
  return _s3
}

function dataKey(orgId) {
  return orgId ? `orgs/${orgId}/data.json` : 'data.json'
}

function statementsIndexKey(orgId) {
  return orgId ? `orgs/${orgId}/statements/index.json` : 'statements/index.json'
}

function statementKey(orgId, statementId) {
  return orgId ? `orgs/${orgId}/statements/${statementId}.json` : `statements/${statementId}.json`
}

async function s3Put(key, data) {
  await getS3().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }))
}

async function s3Get(key) {
  try {
    const res = await getS3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const body = await res.Body.transformToString('utf-8')
    return JSON.parse(body)
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null
    }
    throw err
  }
}

/**
 * Read and parse data.json from S3, scoped to org.
 * Returns null if the file doesn't exist.
 */
export async function readDataJson(orgId) {
  return s3Get(dataKey(orgId))
}

/**
 * Write data.json back to S3, scoped to org.
 */
export async function writeDataJson(data, orgId) {
  await getS3().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: dataKey(orgId),
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }))
}

/**
 * Read a statement from S3, scoped to org.
 * If statementId is provided, reads that specific statement.
 * Otherwise reads the statements index.
 */
export async function readStatement(orgId, statementId) {
  const key = statementId ? statementKey(orgId, statementId) : statementsIndexKey(orgId)
  return s3Get(key)
}

/**
 * Read the statements index from S3, scoped to org.
 * Returns a default empty index if the file doesn't exist.
 */
export async function readStatementIndex(orgId) {
  const data = await s3Get(statementsIndexKey(orgId))
  return data || { version: 1, lastUpdated: null, statements: [] }
}

/**
 * Write a single statement to S3, scoped to org.
 */
export async function writeStatement(orgId, statementId, data) {
  await getS3().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: statementKey(orgId, statementId),
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }))
}

/**
 * Write the statements index to S3, scoped to org.
 */
export async function writeStatementIndex(orgId, index) {
  await getS3().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: statementsIndexKey(orgId),
    Body: JSON.stringify(index, null, 2),
    ContentType: 'application/json',
  }))
}

/**
 * Delete a single statement from S3, scoped to org.
 */
export async function deleteStatement(orgId, statementId) {
  await getS3().send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: statementKey(orgId, statementId),
  }))
}

// ── Snapshots ──

function snapshotIndexKey(orgId) {
  return orgId ? `orgs/${orgId}/snapshots/index.json` : 'snapshots/index.json'
}

function snapshotKey(orgId, date) {
  return orgId ? `orgs/${orgId}/snapshots/${date}.json` : `snapshots/${date}.json`
}

export async function readSnapshotIndex(orgId) {
  const data = await s3Get(snapshotIndexKey(orgId))
  return data || { version: 1, dates: [] }
}

export async function writeSnapshotIndex(orgId, index) {
  await s3Put(snapshotIndexKey(orgId), index)
}

export async function readSnapshot(orgId, date) {
  return s3Get(snapshotKey(orgId, date))
}

export async function writeSnapshot(orgId, date, snapshot) {
  await s3Put(snapshotKey(orgId, date), snapshot)
}

export async function deleteSnapshot(orgId, date) {
  await getS3().send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: snapshotKey(orgId, date),
  }))
}

// ── Plaid accounts cache ──
// Stores the last-known accounts response so /plaid/accounts never needs to
// call Plaid directly. Written by sync and exchange handlers; read by accounts handler.

function accountsCacheKey(orgId) {
  return orgId ? `orgs/${orgId}/plaid-accounts-cache.json` : 'plaid-accounts-cache.json'
}

/**
 * Read the cached Plaid accounts response from S3.
 * Returns null if no cache exists yet.
 */
export async function readAccountsCache(orgId) {
  return s3Get(accountsCacheKey(orgId))
}

/**
 * Write the Plaid accounts cache to S3.
 * Shape: { cachedAt: ISO, items: [...] }
 */
export async function writeAccountsCache(orgId, items) {
  await getS3().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: accountsCacheKey(orgId),
    Body: JSON.stringify({ cachedAt: new Date().toISOString(), items }, null, 2),
    ContentType: 'application/json',
  }))
}
