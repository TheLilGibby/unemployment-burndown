import { authenticator } from 'otplib'
import { getUser } from '../lib/users.mjs'
import { requireAuth, signToken } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'

/**
 * POST /api/auth/verify-mfa
 * Headers: Authorization: Bearer <tempToken>
 * Body: { code }
 *
 * Verifies a TOTP code and returns a full-access JWT.
 */
export async function handler(event) {
  try {
    // tempToken is a JWT with mfaVerified=false
    const { user: tokenUser, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { code } = body

    if (!code) {
      return err(400, 'MFA code is required')
    }

    const user = await getUser(tokenUser.sub)
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return err(400, 'MFA is not enabled for this account')
    }

    const isValid = authenticator.verify({ token: code, secret: user.mfaSecret })
    if (!isValid) {
      return err(401, 'Invalid MFA code')
    }

    // Issue a full-access token with org info
    const token = signToken(user.userId, {
      mfaVerified: true,
      orgId: user.orgId || null,
      orgRole: user.orgRole || null,
    })
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
    console.error('verifyMfa error:', error.message)
    return err(500, 'MFA verification failed')
  }
}
