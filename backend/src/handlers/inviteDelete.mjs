import { requireOrg } from '../lib/auth.mjs'
import { getInvite, deleteInvite } from '../lib/invites.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * DELETE /api/org/invites/{inviteId}
 * Headers: Authorization: Bearer <token>
 *
 * Revokes/deletes a pending invite. Only owners can revoke.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (tokenUser.orgRole !== 'owner') {
      return err(403, 'Only household owners can revoke invites')
    }

    const inviteId = event.pathParameters?.inviteId
    if (!inviteId) return err(400, 'Invite ID is required')

    const invite = await getInvite(inviteId)
    if (!invite) return err(404, 'Invite not found')

    if (invite.orgId !== tokenUser.orgId) {
      return err(403, 'This invite does not belong to your household')
    }

    await deleteInvite(inviteId)

    const audit = createAuditLogger('inviteDelete', event)
    audit.info({ inviteId, orgId: tokenUser.orgId, email: invite.email }, 'invite revoked')

    return ok({ message: 'Invite revoked' })
  } catch (error) {
    const log = createRequestLogger('inviteDelete', event)
    log.error({ err: error }, 'invite delete failed')
    return err(500, 'Failed to revoke invite')
  }
}
