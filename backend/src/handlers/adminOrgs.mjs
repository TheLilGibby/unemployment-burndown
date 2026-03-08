import { requireSuperAdmin } from '../lib/auth.mjs'
import { listAllOrgs } from '../lib/orgs.mjs'
import { countMembersByOrg } from '../lib/orgMembers.mjs'
import { ok, err, parsePagination, encodeCursor } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * GET /api/admin/orgs
 * Superadmin-only: list all organizations with member counts.
 * Uses cursor-based pagination and SELECT COUNT to avoid N+1 full-fetch.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const audit = createAuditLogger('admin:listOrgs', event)
    audit.info({ adminUserId: user.sub }, 'superadmin listed all organizations')

    const { limit, exclusiveStartKey } = parsePagination(event)
    const { items: allOrgs, lastEvaluatedKey } = await listAllOrgs({ limit, exclusiveStartKey })

    const orgs = await Promise.all(allOrgs.map(async (org) => {
      const memberCount = await countMembersByOrg(org.orgId)
      return {
        orgId: org.orgId,
        name: org.name,
        ownerId: org.ownerId,
        memberCount,
        createdAt: org.createdAt,
      }
    }))

    return ok({ orgs, nextCursor: encodeCursor(lastEvaluatedKey) })
  } catch (error) {
    const log = createRequestLogger('adminOrgs', event)
    log.error({ err: error }, 'failed to list organizations')
    return err(500, 'Failed to list organizations')
  }
}
