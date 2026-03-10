import bcrypt from 'bcryptjs'
import { getUserByEmail, incrementLoginAttempts, clearLoginAttempts } from '../lib/users.mjs'
import { signToken, isEnvSuperAdmin } from '../lib/auth.mjs'
import { ok, err, rateLimited } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'
import { checkRateLimit, getClientIp } from '../lib/rateLimit.mjs'

const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Returns:
 *   - If MFA disabled: { token, user }
 *   - If MFA enabled:  { mfaRequired: true, tempToken } (tempToken is used for /verify-mfa)
 *   - If account locked: 423 with retryAfter seconds
 */
export async function handler(event) {
  try {
    // Rate limit: 20 login attempts per minute per IP (per-user lockout handles individual accounts)
    const ip = getClientIp(event)
    const rl = await checkRateLimit({ scope: 'login', key: ip, maxRequests: 20, windowMs: 60_000, event })
    if (!rl.allowed) return rateLimited(rl.retryAfter)

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

    // Check if account is locked
    if (user.accountLockedUntil) {
      const lockedUntil = new Date(user.accountLockedUntil)
      if (lockedUntil > new Date()) {
        const retryAfterMs = lockedUntil.getTime() - Date.now()
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
        audit.warn({ userId: user.userId, result: 'account_locked', lockedUntil: user.accountLockedUntil }, 'login attempt on locked account')
        return err(423, `Account is temporarily locked. Try again in ${retryAfterSeconds} seconds.`)
      }
      // Lockout expired � clear it so the user starts fresh
      await clearLoginAttempts(user.userId)
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      const attempts = (user.failedLoginAttempts || 0) + 1
      const willLock = attempts >= MAX_LOGIN_ATTEMPTS
      const lockoutUntil = willLock ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : null

      await incrementLoginAttempts(user.userId, lockoutUntil)

      if (willLock) {
        audit.warn({ userId: user.userId, result: 'account_locked', attempts }, 'account locked after too many failed attempts')
        return err(423, 'Too many failed login attempts. Account is temporarily locked for 15 minutes.')
      }

      audit.warn({ userId: user.userId, result: 'invalid_password', attempts }, 'login attempt with wrong password')
      return err(401, 'Invalid email or password')
    }

    // Successful login � clear any failed attempt counter
    if (user.failedLoginAttempts > 0) {
      await clearLoginAttempts(user.userId)
    }

    const isSuperAdmin = isEnvSuperAdmin(user.email)
    const orgOpts = { orgId: user.orgId || null, orgRole: user.orgRole || null, isSuperAdmin, tier: user.tier || 'free' }

    // If MFA is enabled, return a temporary token that requires MFA verification
    if (user.mfaEnabled) {
      const tempToken = signToken(user.userId, { mfaVerified: false, ...orgOpts })
      audit.info({ userId: user.userId, result: 'mfa_required' }, 'login requires MFA verification')
      return ok({
        mfaRequired: true,
        tempToken,
      })
    }

    // No MFA � return full access token
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
        isSuperAdmin,
        tier: user.tier || 'free',
      },
    })
  } catch (error) {
    const log = createRequestLogger('login', event)
    log.error({ err: error }, 'login failed')
    return err(500, 'Login failed')
  }
}
