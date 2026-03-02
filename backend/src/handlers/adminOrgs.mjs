import { requireSuperAdmin } from '../lib/auth.mjs'
import { listAllOrgs } from '../lib/orgs.mjs'
import { getMembersByOrg } from '../lib/orgMembers.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * GET /api/admin/orgs
 * Superadmin-only: list all organizations with member counts.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const audit = createAuditLogger('admin:listOrgs', event)
    audit.info({ adminUserId: user.sub }, 'superadmin listed all organizations')

    const allOrgs = await listAllOrgs()

    const orgs = await Promise.all(allOrgs.map(async (org) => {
      const members = await getMembersByOrg(org.orgId)
      return {
        orgId: org.orgId,
        name: org.name,
        ownerId: org.ownerId,
        memberCount: members.length,
        createdAt: org.createdAt,
      }
    }))

    return ok({ orgs })
  } catch (error) {
    const log = createRequestLogger('adminOrgs', event)
    log.error({ err: error }, 'failed to list organizations')
    return err(500, 'Failed to list organizations')
  }
}
