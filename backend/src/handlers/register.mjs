import bcrypt from 'bcryptjs'
import { createUser, getUserByEmail } from '../lib/users.mjs'
import { signToken } from '../lib/auth.mjs'
import { getInviteByToken } from '../lib/invites.mjs'
import { ok, err, rateLimited } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'
import { checkRateLimit, getClientIp } from '../lib/rateLimit.mjs'

const E164_REGEX = /^\+[1-9]\d{6,14}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/auth/register
 * Body: { email, password, inviteToken?, phoneNumber? }
 * Creates a new user account and returns a JWT.
 *
 * If inviteToken is provided, phoneNumber is required for mandatory 2FA setup.
 */
export async function handler(event) {
  try {
    // Rate limit: 5 registrations per minute per IP
    const ip = getClientIp(event)
    const rl = await checkRateLimit({ scope: 'register', key: ip, maxRequests: 5, windowMs: 60_000, event })
    if (!rl.allowed) return rateLimited(rl.retryAfter)

    const body = JSON.parse(event.body || '{}')
    const { email, password, inviteToken, phoneNumber } = body

    if (!email || !password) {
      return err(400, 'Email and password are required')
    }

    if (!EMAIL_REGEX.test(email)) {
      return err(400, 'Invalid email format')
    }

    if (password.length < 8) {
      return err(400, 'Password must be at least 8 characters')
    }

    // Validate invite token if provided
    let invite = null
    if (inviteToken) {
      invite = await getInviteByToken(inviteToken)
      if (!invite) {
        return err(400, 'Invalid invite token')
      }
      if (invite.status !== 'pending') {
        return err(410, 'This invite has already been used or revoked')
      }
      if (new Date(invite.expiresAt) < new Date()) {
        return err(410, 'This invite has expired')
      }
      // Verify email matches invite
      if (invite.email !== email.toLowerCase()) {
        return err(400, 'Email does not match the invite')
      }
      // Phone number required for invite-based registration
      if (!phoneNumber) {
        return err(400, 'Phone number is required for invited users (2FA setup)')
      }
      if (!E164_REGEX.test(phoneNumber)) {
        return err(400, 'Phone number must be in E.164 format (e.g. +15551234567)')
      }
    }

    // Check if user already exists
    const existing = await getUserByEmail(email)
    if (existing) {
      return err(409, 'An account with this email already exists')
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 12)
    const userId = email.toLowerCase()

    await createUser({
      userId,
      email,
      passwordHash,
      phoneNumber: phoneNumber || null,
      inviteToken: inviteToken || null,
    })

    const audit = createAuditLogger('register', event)
    audit.info({ userId, viaInvite: !!inviteToken }, 'new user registered')

    // For invite-based registration, phone verification is required
    const phoneVerificationRequired = !!inviteToken

    // mfaVerified: true for non-invite users (no MFA), false for invite users (need phone verification)
    const token = signToken(userId, { mfaVerified: !phoneVerificationRequired, orgId: null, orgRole: null, tier: 'free' })

    return ok({
      token,
      user: {
        userId,
        email: email.toLowerCase(),
        mfaEnabled: false,
        phoneNumber: phoneNumber || null,
        phoneVerified: false,
        orgId: null,
        orgRole: null,
        tier: 'free',
      },
      phoneVerificationRequired,
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
