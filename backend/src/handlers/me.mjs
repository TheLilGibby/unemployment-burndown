import { getUser } from '../lib/users.mjs'
import { requireAuth } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'

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
      orgId: user.orgId || null,
      orgRole: user.orgRole || null,
      createdAt: user.createdAt,
    })
  } catch (error) {
    console.error('me error:', error.message)
    return err(500, error.message)
  }
}
