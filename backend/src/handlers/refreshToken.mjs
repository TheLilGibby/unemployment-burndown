import { getUserByEmail } from '../lib/users.mjs'
import { requireAuth, signToken, isEnvSuperAdmin } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * POST /api/auth/refresh
 * Authorization: Bearer <current-token>
 *
 * Issues a fresh JWT with the same claims but a new expiry.
 * Requires a valid, non-expired token with mfaVerified: true.
 */
export async function handler(event) {
  try {
    const auth = requireAuth(event, { requireMfa: true })
    if (auth.error) {
      return err(auth.error.statusCode, auth.error.message)
    }

    const { user: payload } = auth
    const audit = createAuditLogger('refreshToken', event)

    // Look up current user to ensure account still exists and is active
    const user = await getUserByEmail(payload.sub)
    if (!user) {
      audit.warn({ userId: payload.sub, result: 'user_not_found' }, 'token refresh for deleted account')
      return err(401, 'Account no longer exists')
    }

    // Check if account is locked
    if (user.accountLockedUntil) {
      const lockedUntil = new Date(user.accountLockedUntil)
      if (lockedUntil > new Date()) {
        audit.warn({ userId: user.userId, result: 'account_locked' }, 'token refresh for locked account')
        return err(423, 'Account is temporarily locked')
      }
    }

    // Issue fresh token with current user state
    const isSuperAdmin = isEnvSuperAdmin(user.email)
    const token = signToken(user.userId, {
      mfaVerified: true,
      orgId: user.orgId || null,
      orgRole: user.orgRole || null,
      isSuperAdmin,
      impersonatedBy: payload.impersonatedBy || null,
    })

    audit.info({ userId: user.userId, result: 'success' }, 'token refreshed')

    return ok({ token })
  } catch (error) {
    const log = createRequestLogger('refreshToken', event)
    log.error({ err: error }, 'token refresh failed')
    return err(500, 'Token refresh failed')
  }
}
