import { requireOrg } from '../lib/auth.mjs'
import { getUser, getUserByEmail } from '../lib/users.mjs'
import { getOrg } from '../lib/orgs.mjs'
import { getMembersByOrg } from '../lib/orgMembers.mjs'
import { createInvite, getInvitesByEmail } from '../lib/invites.mjs'
import { sendInviteEmail } from '../lib/email.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * POST /api/org/invites
 * Headers: Authorization: Bearer <token>
 * Body: { email }
 *
 * Creates an invite for a user to join the household.
 * Only owners can create invites.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (tokenUser.orgRole !== 'owner') {
      return err(403, 'Only household owners can send invites')
    }

    const body = JSON.parse(event.body || '{}')
    const { email } = body

    if (!email || !email.trim()) {
      return err(400, 'Email address is required')
    }

    const emailLower = email.trim().toLowerCase()

    // Check if user is already a member
    const members = await getMembersByOrg(tokenUser.orgId)
    const alreadyMember = members.find(m => m.userId === emailLower)
    if (alreadyMember) {
      return err(409, 'This user is already a member of your household')
    }

    // Check for existing pending invite
    const existingInvites = await getInvitesByEmail(emailLower)
    const pendingForOrg = existingInvites.find(
      inv => inv.orgId === tokenUser.orgId && inv.status === 'pending' && new Date(inv.expiresAt) > new Date()
    )
    if (pendingForOrg) {
      return err(409, 'An active invite already exists for this email')
    }

    // Get org details for the email
    const org = await getOrg(tokenUser.orgId)
    if (!org) return err(404, 'Organization not found')

    const inviter = await getUser(tokenUser.sub)

    // Create the invite
    const { inviteId, inviteToken, expiresAt } = await createInvite({
      orgId: tokenUser.orgId,
      email: emailLower,
      invitedBy: tokenUser.sub,
    })

    // Send invite email
    const APP_URL = process.env.APP_URL || 'http://localhost:5173'
    const inviteUrl = `${APP_URL}/accept-invite?token=${inviteToken}`

    await sendInviteEmail(emailLower, inviter?.email || tokenUser.sub, org.name, inviteUrl)

    const audit = createAuditLogger('inviteCreate', event)
    audit.info({ inviteId, orgId: tokenUser.orgId, invitedEmail: emailLower }, 'invite created')

    return ok({
      invite: {
        inviteId,
        email: emailLower,
        status: 'pending',
        expiresAt,
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    const log = createRequestLogger('inviteCreate', event)
    log.error({ err: error }, 'invite creation failed')
    return err(500, 'Failed to create invite')
  }
}
