if (!process.env.ALLOWED_ORIGIN) {
  throw new Error('ALLOWED_ORIGIN environment variable is required')
}
const ORIGIN = process.env.ALLOWED_ORIGIN

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
}

export function ok(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify(body),
  }
}

export function err(statusCode, message) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    body: JSON.stringify({ error: message }),
  }
}

export function rateLimited(retryAfter) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
      ...CORS_HEADERS,
    },
    body: JSON.stringify({ error: 'Too many requests. Please try again later.' }),
  }
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export function parsePagination(event) {
  const qs = event.queryStringParameters || {}
  let limit = parseInt(qs.limit, 10)
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  let exclusiveStartKey = undefined
  if (qs.cursor) {
    try {
      exclusiveStartKey = JSON.parse(Buffer.from(qs.cursor, 'base64url').toString())
    } catch {
      // invalid cursor — ignore, start from beginning
    }
  }

  return { limit, exclusiveStartKey }
}

export function encodeCursor(lastEvaluatedKey) {
  if (!lastEvaluatedKey) return undefined
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64url')
}
