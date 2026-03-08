import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { createAuditLogger } from './logger.mjs'

const TABLE = process.env.RATE_LIMIT_TABLE || 'RateLimits'

let _doc = null
function doc() {
  if (_doc) return _doc
  _doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  return _doc
}

/**
 * Extract the client IP address from an API Gateway event.
 * Prefers requestContext.identity.sourceIp (set by API Gateway),
 * falls back to X-Forwarded-For header.
 */
export function getClientIp(event) {
  return event?.requestContext?.identity?.sourceIp
    || event?.headers?.['X-Forwarded-For']?.split(',')[0]?.trim()
    || event?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || 'unknown'
}

/**
 * Fixed-window rate limiter backed by DynamoDB.
 *
 * Uses atomic ADD to increment a counter per (scope, key, window).
 * Items auto-expire via DynamoDB TTL, so no cleanup is needed.
 *
 * @param {object} opts
 * @param {string} opts.scope    - Endpoint name, e.g. 'register', 'forgot-password'
 * @param {string} opts.key      - Rate-limit key, e.g. IP address or email
 * @param {number} opts.maxRequests - Max requests allowed per window
 * @param {number} opts.windowMs - Window size in milliseconds
 * @param {object} [opts.event]  - API Gateway event (for audit logging)
 * @returns {Promise<{allowed: boolean, retryAfter?: number, current: number}>}
 */
export async function checkRateLimit({ scope, key, maxRequests, windowMs, event }) {
  const windowId = Math.floor(Date.now() / windowMs)
  const pk = `${scope}#${key}#${windowId}`
  const ttl = Math.floor(Date.now() / 1000) + Math.ceil(windowMs / 1000) * 2

  const result = await doc().send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk },
    UpdateExpression: 'ADD requestCount :one SET #ttl = if_not_exists(#ttl, :ttl)',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: { ':one': 1, ':ttl': ttl },
    ReturnValues: 'ALL_NEW',
  }))

  const current = result.Attributes.requestCount

  if (current > maxRequests) {
    const windowEndMs = (windowId + 1) * windowMs
    const retryAfter = Math.max(1, Math.ceil((windowEndMs - Date.now()) / 1000))

    if (event) {
      const audit = createAuditLogger('rate-limit', event)
      audit.warn({ scope, key, current, maxRequests, retryAfter }, 'rate limit exceeded')
    }

    return { allowed: false, retryAfter, current }
  }

  return { allowed: true, current }
}
