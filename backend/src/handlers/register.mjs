import bcrypt from 'bcryptjs'
import { createUser, getUserByEmail } from '../lib/users.mjs'
import { signToken } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * POST /api/auth/register
 * Body: { email, password }
 * Creates a new user account and returns a JWT.
 */
export async function handler(event) {
  try {
    const body = JSON.parse(event.body || '{}')
    const { email, password } = body

    if (!email || !password) {
      return err(400, 'Email and password are required')
    }

    if (password.length < 8) {
      return err(400, 'Password must be at least 8 characters')
    }

    // Check if user already exists
    const existing = await getUserByEmail(email)
    if (existing) {
      return err(409, 'An account with this email already exists')
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12)
    const userId = email.toLowerCase()

    await createUser({ userId, email, passwordHash })

    const audit = createAuditLogger('register', event)
    audit.info({ userId }, 'new user registered')

    // Return JWT (no MFA yet, no org yet for new accounts)
    // mfaVerified: true because this user has no MFA — consistent with the login flow
    const token = signToken(userId, { mfaVerified: true, orgId: null, orgRole: null })

    return ok({
      token,
      user: { userId, email: email.toLowerCase(), mfaEnabled: false, orgId: null, orgRole: null },
    })
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      return err(409, 'An account with this email already exists')
    }
    const log = createRequestLogger('register', event)
    log.error({ err: error }, 'registration failed')
    return err(500, 'Registration failed')
  }
}
