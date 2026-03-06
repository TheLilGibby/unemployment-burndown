import { requireOrg } from '../lib/auth.mjs'
import { getInvitesByOrg } from '../lib/invites.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /api/org/invites
 * Headers: Authorization: Bearer <token>
 *
 * Lists all invites for the current org. Only owners can view.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (tokenUser.orgRole !== 'owner') {
      return err(403, 'Only household owners can view invites')
    }

    const invites = await getInvitesByOrg(tokenUser.orgId)

    // Filter out sensitive fields and sort by creation date
    const filtered = invites
      .map(inv => ({
        inviteId: inv.inviteId,
        email: inv.email,
        status: inv.status,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        expired: new Date(inv.expiresAt) < new Date(),
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return ok({ invites: filtered })
  } catch (error) {
    const log = createRequestLogger('inviteList', event)
    log.error({ err: error }, 'invite list failed')
    return err(500, 'Failed to list invites')
  }
}
