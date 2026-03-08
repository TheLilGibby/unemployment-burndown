import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getUserByResetTokenHash, updatePassword, clearResetToken } from '../lib/users.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 *
 * Validates the reset token and updates the password.
 * Looks up user by token hash — no email required.
 */
export async function handler(event) {
  try {
    const body = JSON.parse(event.body || '{}')
    const { token, password } = body

    if (!token || !password) {
      return err(400, 'Token and new password are required')
    }

    if (password.length < 8) {
      return err(400, 'Password must be at least 8 characters')
    }

    const audit = createAuditLogger('reset-password', event)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const user = await getUserByResetTokenHash(tokenHash)

    if (!user) {
      audit.warn({ result: 'invalid_token' }, 'reset attempt with unknown token')
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
