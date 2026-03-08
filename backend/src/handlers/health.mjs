import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import { ok } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

const USERS_TABLE = process.env.USERS_TABLE || 'BurndownUsers'
const BUCKET     = process.env.S3_BUCKET   || 'rag-consulting-burndown'
const S3_REGION  = process.env.S3_REGION   || 'us-west-1'

let _dynamo = null
function getDynamo() {
  if (_dynamo) return _dynamo
  _dynamo = new DynamoDBClient({})
  return _dynamo
}

let _s3 = null
function getS3() {
  if (_s3) return _s3
  _s3 = new S3Client({ region: S3_REGION })
  return _s3
}

export async function handler(event) {
  const log = createRequestLogger('health', event)

  const checks = {}
  let healthy = true

  const [dynamoResult, s3Result] = await Promise.allSettled([
    getDynamo().send(new DescribeTableCommand({ TableName: USERS_TABLE })),
    getS3().send(new HeadBucketCommand({ Bucket: BUCKET })),
  ])

  if (dynamoResult.status === 'fulfilled') {
    checks.dynamodb = 'ok'
  } else {
    log.error({ err: dynamoResult.reason }, 'DynamoDB health check failed')
    checks.dynamodb = 'error'
    healthy = false
  }

  if (s3Result.status === 'fulfilled') {
    checks.s3 = 'ok'
  } else {
    log.error({ err: s3Result.reason }, 'S3 health check failed')
    checks.s3 = 'error'
    healthy = false
  }

  const body = {
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '0.0.1',
    checks,
  }

  log.info({ healthy }, 'health check completed')

  if (!healthy) {
    const ORIGIN = process.env.ALLOWED_ORIGIN || '*'
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin':  ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: JSON.stringify(body),
    }
  }

  return ok(body)
}
