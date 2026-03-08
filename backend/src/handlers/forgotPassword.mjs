import crypto from 'node:crypto'
import { getUserByEmail, setResetToken } from '../lib/users.mjs'
import { ok, rateLimited } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'
import { sendPasswordResetEmail } from '../lib/email.mjs'
import { checkRateLimit, getClientIp } from '../lib/rateLimit.mjs'

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const GENERIC_MSG = 'If an account with that email exists, a password reset link has been sent.'

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 *
 * Always returns 200 with a generic message to prevent email enumeration.
 */
export async function handler(event) {
  try {
    // Rate limit: 10 requests per hour per IP
    const ip = getClientIp(event)
    const ipRl = await checkRateLimit({ scope: 'forgot-password-ip', key: ip, maxRequests: 10, windowMs: 3_600_000, event })
    if (!ipRl.allowed) return rateLimited(ipRl.retryAfter)

    const body = JSON.parse(event.body || '{}')
    const { email } = body

    if (!email) {
      return ok({ message: GENERIC_MSG })
    }

    // Rate limit: 3 resets per hour per email
    const emailRl = await checkRateLimit({ scope: 'forgot-password-email', key: email.toLowerCase(), maxRequests: 3, windowMs: 3_600_000, event })
    if (!emailRl.allowed) return rateLimited(emailRl.retryAfter)

    const audit = createAuditLogger('forgot-password', event)
    const user = await getUserByEmail(email)

    if (!user) {
      audit.info({ email, result: 'no_account' }, 'forgot-password for unknown email')
      return ok({ message: GENERIC_MSG })
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()

    await setResetToken(user.userId, tokenHash, expiry)
    await sendPasswordResetEmail(user.email, rawToken)

    audit.info({ userId: user.userId, result: 'token_sent' }, 'password reset token generated')
    return ok({ message: GENERIC_MSG })
  } catch (error) {
    const log = createRequestLogger('forgot-password', event)
    log.error({ err: error }, 'forgot-password failed')
    return ok({ message: GENERIC_MSG })
  }
}
