import { requireAuth, signToken } from '../lib/auth.mjs'
import { getUser, setPhoneVerified, incrementOtpAttempts } from '../lib/users.mjs'
import { hashOtp } from '../lib/sms.mjs'
import { getInviteByToken, updateInviteStatus } from '../lib/invites.mjs'
import { getOrg } from '../lib/orgs.mjs'
import { addMember, getMember } from '../lib/orgMembers.mjs'
import { updateUserOrg } from '../lib/users.mjs'
import { readDataJson, writeDataJson } from '../lib/s3.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

const MAX_ATTEMPTS = 5

/**
 * POST /api/auth/verify-phone-otp
 * Headers: Authorization: Bearer <token>
 * Body: { code }
 *
 * Verifies a phone OTP code. On success, enables SMS 2FA.
 * If the user signed up via invite, also joins them to the household.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { code } = body

    if (!code || code.length !== 6) {
      return err(400, 'A 6-digit verification code is required')
    }

    const user = await getUser(tokenUser.sub)
    if (!user) return err(404, 'User not found')

    if (!user.phoneOtpHash || !user.phoneOtpExpiry) {
      return err(400, 'No pending verification. Request a new code.')
    }

    if (new Date(user.phoneOtpExpiry) < new Date()) {
      return err(410, 'Verification code has expired. Request a new one.')
    }

    if ((user.phoneOtpAttempts || 0) >= MAX_ATTEMPTS) {
      return err(429, 'Too many attempts. Request a new code.')
    }

    // Verify the code
    const codeHash = hashOtp(code)
    if (codeHash !== user.phoneOtpHash) {
      await incrementOtpAttempts(tokenUser.sub)
      return err(401, 'Invalid verification code')
    }

    // Promote pendingPhone to phoneNumber and enable SMS MFA
    await setPhoneVerified(tokenUser.sub, user.pendingPhone)

    const audit = createAuditLogger('verifyPhoneOtp', event)
    audit.info({ userId: tokenUser.sub }, 'phone verified, SMS 2FA enabled')

    // If user signed up via invite, join them to the household
    let orgId = user.orgId || null
    let orgRole = user.orgRole || null

    if (user.inviteToken && !user.orgId) {
      const invite = await getInviteByToken(user.inviteToken)
      if (invite && invite.status === 'pending') {
        const org = await getOrg(invite.orgId)
        if (org) {
          // Check not already a member
          const existingMember = await getMember(invite.orgId, user.userId)
          if (!existingMember) {
            await addMember({ orgId: invite.orgId, userId: user.userId, role: 'member' })
            await updateUserOrg(user.userId, invite.orgId, 'member')

            // Add as a person in the org's data.json
            const data = await readDataJson(invite.orgId)
            if (data && data.state) {
              const maxId = data.state.people?.reduce((max, p) => Math.max(max, p.id || 0), 0) || 0
              data.state.people = data.state.people || []
              data.state.people.push({
                id: maxId + 1,
                name: user.email.split('@')[0],
                color: '#8b5cf6',
                linkedUserId: user.userId,
                email: user.email,
              })
              data.savedAt = new Date().toISOString()
              await writeDataJson(data, invite.orgId)
            }

            orgId = invite.orgId
            orgRole = 'member'

            audit.info({ userId: user.userId, orgId: invite.orgId }, 'user joined org via invite')
          }

          // Mark invite as accepted
          await updateInviteStatus(invite.inviteId, 'accepted')
        }
      }
    }

    // Issue new JWT with updated info
    const token = signToken(user.userId, {
      mfaVerified: true,
      orgId,
      orgRole,
    })

    return ok({
      token,
      user: {
        userId: user.userId,
        email: user.email,
        mfaEnabled: true,
        mfaMethod: 'sms',
        phoneNumber: user.pendingPhone || user.phoneNumber,
        phoneVerified: true,
        orgId,
        orgRole,
      },
    })
  } catch (error) {
    const log = createRequestLogger('verifyPhoneOtp', event)
    log.error({ err: error }, 'phone OTP verification failed')
    return err(500, 'Failed to verify code')
  }
}
