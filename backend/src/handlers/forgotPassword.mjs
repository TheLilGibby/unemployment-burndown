import crypto from 'node:crypto'
import { getUserByEmail, setResetToken } from '../lib/users.mjs'
import { ok } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'
import { sendPasswordResetEmail } from '../lib/email.mjs'

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
    const body = JSON.parse(event.body || '{}')
    const { email } = body

    if (!email) {
      return ok({ message: GENERIC_MSG })
    }

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
