import { authenticator } from 'otplib'
import { getUser } from '../lib/users.mjs'
import { requireAuth, signToken, isEnvSuperAdmin } from '../lib/auth.mjs'
import { ok, err, rateLimited } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'
import { checkRateLimit, getClientIp } from '../lib/rateLimit.mjs'

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

    // Rate limit: 10 MFA verify attempts per minute per IP
    const ip = getClientIp(event)
    const rl = await checkRateLimit({ scope: 'verify-mfa', key: ip, maxRequests: 10, windowMs: 60_000, event })
    if (!rl.allowed) return rateLimited(rl.retryAfter)

    const body = JSON.parse(event.body || '{}')
    const { code } = body

    if (!code) {
      return err(400, 'MFA code is required')
    }

    const user = await getUser(tokenUser.sub)
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return err(400, 'MFA is not enabled for this account')
    }

    const audit = createAuditLogger('verifyMfa', event)
    const isValid = authenticator.verify({ token: code, secret: user.mfaSecret })
    if (!isValid) {
      audit.warn({ userId: user.userId, result: 'invalid_code' }, 'MFA verification failed - invalid code')
      return err(401, 'Invalid MFA code')
    }

    audit.info({ userId: user.userId, result: 'success' }, 'MFA verification successful')

    // Issue a full-access token with org info
    const isSuperAdmin = isEnvSuperAdmin(user.email)
    const token = signToken(user.userId, {
      mfaVerified: true,
      orgId: user.orgId || null,
      orgRole: user.orgRole || null,
      isSuperAdmin,
    })
    return ok({
      token,
      user: {
        userId: user.userId,
        email: user.email,
        mfaEnabled: user.mfaEnabled,
        orgId: user.orgId || null,
        orgRole: user.orgRole || null,
        isSuperAdmin,
      },
    })
  } catch (error) {
    const log = createRequestLogger('verifyMfa', event)
    log.error({ err: error }, 'MFA verification failed')
    return err(500, 'MFA verification failed')
  }
}
