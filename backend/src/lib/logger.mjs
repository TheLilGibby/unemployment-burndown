import pino from 'pino'

// ── Sensitive field paths to redact from logs ──
const REDACT_PATHS = [
  'accessToken',
  'access_token',
  'password',
  'passwordHash',
  'token',
  'tempToken',
  'secret',
  'mfaSecret',
  'authorization',
  'req.headers.authorization',
  'event.headers.authorization',
  'event.headers.Authorization',
  'body.password',
  'body.secret',
  'body.access_token',
  'body.public_token',
]

// ── Log level from env (default: info in prod, debug in dev) ──
const LOG_LEVEL = process.env.LOG_LEVEL
  || (process.env.AWS_LAMBDA_FUNCTION_NAME ? 'info' : 'debug')

/**
 * Create a structured Pino logger configured for Lambda / CloudWatch.
 *
 * In Lambda, logs go to CloudWatch as JSON — no pretty-printing.
 * Locally, we use pino-pretty if available for developer readability.
 */
function createLogger(name = 'burndown-backend') {
  const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME

  const options = {
    name,
    level: LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Include the AWS request ID when running in Lambda
    ...(isLambda && process.env.AWS_REQUEST_ID
      ? { base: { awsRequestId: process.env.AWS_REQUEST_ID } }
      : {}),
    formatters: {
      level(label) {
        return { level: label }
      },
    },
  }

  return pino(options)
}

// Singleton logger instance
const logger = createLogger()

/**
 * Create a child logger scoped to a specific Lambda handler invocation.
 * Includes the handler name, request ID, and optional user context.
 *
 * Usage:
 *   const log = createRequestLogger('sync', event)
 *   log.info({ itemCount: 3 }, 'starting sync')
 *   log.error({ err }, 'sync failed')
 */
export function createRequestLogger(handlerName, event = {}) {
  const context = {
    handler: handlerName,
  }

  // Extract AWS Lambda request ID for correlation
  const requestId = event?.requestContext?.requestId
    || event?.headers?.['x-amzn-requestcontext']
    || undefined
  if (requestId) context.requestId = requestId

  // Extract correlation ID from upstream caller (if provided)
  const correlationId = event?.headers?.['x-correlation-id']
    || event?.headers?.['X-Correlation-Id']
    || undefined
  if (correlationId) context.correlationId = correlationId

  // HTTP method + path for API Gateway events
  if (event?.httpMethod) context.httpMethod = event.httpMethod
  if (event?.path) context.path = event.path

  return logger.child(context)
}

/**
 * Create an audit logger for security-sensitive events.
 * Audit entries include a fixed `audit: true` field for easy filtering
 * in CloudWatch Insights or any log aggregation tool.
 *
 * Usage:
 *   const audit = createAuditLogger('login', event)
 *   audit.info({ userId, result: 'success' }, 'user authenticated')
 *   audit.warn({ userId, result: 'failed' }, 'invalid credentials')
 */
export function createAuditLogger(operation, event = {}) {
  const requestId = event?.requestContext?.requestId || undefined
  return logger.child({
    audit: true,
    operation,
    ...(requestId ? { requestId } : {}),
  })
}

export default logger
