import pino from 'pino'
import crypto from 'node:crypto'

const LOG_LEVEL = process.env.LOG_LEVEL || 'debug'

// ── Sensitive field paths to redact from logs ──
const REDACT_PATHS = [
  'accessToken',
  'access_token',
  'password',
  'passwordHash',
  'token',
  'tempToken',
  'resetToken',
  'resetTokenHash',
  'secret',
  'mfaSecret',
  'req.headers.authorization',
  'body.password',
  'body.secret',
  'body.access_token',
  'body.public_token',
  'body.token',
]

// Use pino-pretty in dev for readable console output
const transport = process.env.NODE_ENV === 'production'
  ? undefined
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    }

const logger = pino({
  name: 'burndown-dev-server',
  level: LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label }
    },
  },
  ...(transport ? { transport } : {}),
})

/**
 * Express request logging middleware.
 * Attaches a child logger to `req.log` with a unique request ID,
 * and logs request completion with duration and status code.
 */
export function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  const start = Date.now()

  req.log = logger.child({
    requestId,
    method: req.method,
    path: req.path,
  })

  req.log.info('request received')

  res.on('finish', () => {
    const duration = Date.now() - start
    const logData = {
      statusCode: res.statusCode,
      durationMs: duration,
    }

    if (res.statusCode >= 500) {
      req.log.error(logData, 'request completed with server error')
    } else if (res.statusCode >= 400) {
      req.log.warn(logData, 'request completed with client error')
    } else {
      req.log.info(logData, 'request completed')
    }
  })

  next()
}

/**
 * Create an audit logger for the dev server.
 */
export function createAuditLogger(operation) {
  return logger.child({ audit: true, operation })
}

export default logger
