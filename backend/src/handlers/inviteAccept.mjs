import { getInviteByToken } from '../lib/invites.mjs'
import { getOrg } from '../lib/orgs.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /api/org/invites/validate?token=xxx
 * Public endpoint — no auth required.
 *
 * Validates an invite token and returns org info for the accept flow.
 */
export async function handler(event) {
  try {
    const token = event.queryStringParameters?.token
    if (!token) return err(400, 'Invite token is required')

    const invite = await getInviteByToken(token)
    if (!invite) return err(404, 'Invalid or expired invite')

    if (invite.status !== 'pending') {
      return err(410, 'This invite has already been used or revoked')
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return err(410, 'This invite has expired')
    }

    const org = await getOrg(invite.orgId)

    return ok({
      email: invite.email,
      orgName: org?.name || 'Unknown Household',
      orgId: invite.orgId,
      invitedBy: invite.invitedBy,
    })
  } catch (error) {
    const log = createRequestLogger('inviteValidate', event)
    log.error({ err: error }, 'invite validation failed')
    return err(500, 'Failed to validate invite')
  }
}
