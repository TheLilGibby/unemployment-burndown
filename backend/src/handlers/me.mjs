import { getUser } from '../lib/users.mjs'
import { requireAuth, isEnvSuperAdmin } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 *
 * Returns the current user's profile (without sensitive fields).
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const user = await getUser(tokenUser.sub)
    if (!user) return err(404, 'User not found')

    return ok({
      userId: user.userId,
      email: user.email,
      mfaEnabled: user.mfaEnabled,
      mfaMethod: user.mfaMethod || (user.mfaEnabled ? 'totp' : null),
      phoneNumber: user.phoneNumber || null,
      phoneVerified: user.phoneVerified || false,
      orgId: user.orgId || null,
      orgRole: user.orgRole || null,
      profileColor: user.profileColor || 'blue',
      avatarDataUrl: user.avatarDataUrl || null,
      createdAt: user.createdAt,
      isSuperAdmin: isEnvSuperAdmin(user.email),
      impersonatedBy: tokenUser.impersonatedBy || null,
    })
  } catch (error) {
    const log = createRequestLogger('me', event)
    log.error({ err: error }, 'failed to get user profile')
    return err(500, error.message)
  }
}
