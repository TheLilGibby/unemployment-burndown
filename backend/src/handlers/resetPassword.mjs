import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getUserByEmail, updatePassword, clearResetToken } from '../lib/users.mjs'
import { ok, err, rateLimited } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'
import { checkRateLimit, getClientIp } from '../lib/rateLimit.mjs'

/**
 * POST /api/auth/reset-password
 * Body: { email, token, password }
 *
 * Validates the reset token and updates the password.
 */
export async function handler(event) {
  try {
    // Rate limit: 5 reset attempts per hour per IP
    const ip = getClientIp(event)
    const rl = await checkRateLimit({ scope: 'reset-password', key: ip, maxRequests: 5, windowMs: 3_600_000, event })
    if (!rl.allowed) return rateLimited(rl.retryAfter)

    const body = JSON.parse(event.body || '{}')
    const { email, token, password } = body

    if (!email || !token || !password) {
      return err(400, 'Email, token, and new password are required')
    }

    if (password.length < 8) {
      return err(400, 'Password must be at least 8 characters')
    }

    const audit = createAuditLogger('reset-password', event)
    const user = await getUserByEmail(email)

    if (!user) {
      audit.warn({ email, result: 'invalid_token' }, 'reset attempt for unknown email')
      return err(400, 'Invalid or expired reset token')
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    if (!user.resetTokenHash || user.resetTokenHash !== tokenHash) {
      audit.warn({ userId: user.userId, result: 'invalid_token' }, 'reset attempt with wrong token')
      return err(400, 'Invalid or expired reset token')
    }

    if (!user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
      audit.warn({ userId: user.userId, result: 'expired_token' }, 'reset attempt with expired token')
      await clearResetToken(user.userId)
      return err(400, 'Invalid or expired reset token')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await updatePassword(user.userId, passwordHash)

    audit.info({ userId: user.userId, result: 'success' }, 'password reset completed')
    return ok({ message: 'Password has been reset successfully. You can now sign in.' })
  } catch (error) {
    const log = createRequestLogger('reset-password', event)
    log.error({ err: error }, 'password reset failed')
    return err(500, 'Password reset failed')
  }
}
