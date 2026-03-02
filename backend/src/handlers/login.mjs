import bcrypt from 'bcryptjs'
import { getUserByEmail } from '../lib/users.mjs'
import { signToken, isEnvSuperAdmin } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Returns:
 *   - If MFA disabled: { token, user }
 *   - If MFA enabled:  { mfaRequired: true, tempToken } (tempToken is used for /verify-mfa)
 */
export async function handler(event) {
  try {
    const body = JSON.parse(event.body || '{}')
    const { email, password } = body

    if (!email || !password) {
      return err(400, 'Email and password are required')
    }

    const audit = createAuditLogger('login', event)

    const user = await getUserByEmail(email)
    if (!user) {
      audit.warn({ email, result: 'invalid_credentials' }, 'login attempt with unknown email')
      return err(401, 'Invalid email or password')
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      audit.warn({ userId: user.userId, result: 'invalid_password' }, 'login attempt with wrong password')
      return err(401, 'Invalid email or password')
    }

    const isSuperAdmin = isEnvSuperAdmin(user.email)
    const orgOpts = { orgId: user.orgId || null, orgRole: user.orgRole || null, isSuperAdmin }

    // If MFA is enabled, return a temporary token that requires MFA verification
    if (user.mfaEnabled) {
      const tempToken = signToken(user.userId, { mfaVerified: false, ...orgOpts })
      audit.info({ userId: user.userId, result: 'mfa_required' }, 'login requires MFA verification')
      return ok({
        mfaRequired: true,
        tempToken,
      })
    }

    // No MFA — return full access token
    const token = signToken(user.userId, { mfaVerified: true, ...orgOpts })
    audit.info({ userId: user.userId, result: 'success', mfaEnabled: false }, 'user logged in')
    return ok({
      token,
      user: {
        userId: user.userId,
        email: user.email,
        mfaEnabled: user.mfaEnabled,
        orgId: user.orgId || null,
        orgRole: user.orgRole || null,
      },
    })
  } catch (error) {
    const log = createRequestLogger('login', event)
    log.error({ err: error }, 'login failed')
    return err(500, 'Login failed')
  }
}
