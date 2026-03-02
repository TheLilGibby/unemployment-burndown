import { requireSuperAdmin } from '../lib/auth.mjs'
import { getOrg } from '../lib/orgs.mjs'
import { getMembersByOrg } from '../lib/orgMembers.mjs'
import { getUser } from '../lib/users.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * GET /api/admin/orgs/:orgId
 * Superadmin-only: get org details with full member list.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const orgId = event.pathParameters?.orgId
    if (!orgId) return err(400, 'orgId is required')

    const audit = createAuditLogger('admin:getOrgDetail', event)
    audit.info({ adminUserId: user.sub, orgId }, 'superadmin viewed org details')

    const org = await getOrg(orgId)
    if (!org) return err(404, 'Organization not found')

    const members = await getMembersByOrg(orgId)
    const memberList = await Promise.all(members.map(async (m) => {
      const u = await getUser(m.userId)
      return {
        userId: m.userId,
        email: u?.email || m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        mfaEnabled: u?.mfaEnabled || false,
        createdAt: u?.createdAt,
      }
    }))

    return ok({
      orgId: org.orgId,
      name: org.name,
      joinCode: org.joinCode,
      ownerId: org.ownerId,
      createdAt: org.createdAt,
      members: memberList,
    })
  } catch (error) {
    const log = createRequestLogger('adminOrgDetail', event)
    log.error({ err: error }, 'failed to get org detail')
    return err(500, 'Failed to get organization details')
  }
}
