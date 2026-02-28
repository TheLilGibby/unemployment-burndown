import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

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
