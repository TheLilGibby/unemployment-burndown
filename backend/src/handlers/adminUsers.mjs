import { requireSuperAdmin } from '../lib/auth.mjs'
import { listAllUsers } from '../lib/users.mjs'
import { ok, err, parsePagination, encodeCursor } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * GET /api/admin/users
 * Superadmin-only: list all users with cursor-based pagination.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const audit = createAuditLogger('admin:listUsers', event)
    audit.info({ adminUserId: user.sub }, 'superadmin listed all users')

    const { limit, exclusiveStartKey } = parsePagination(event)
    const { items: users, lastEvaluatedKey } = await listAllUsers({ limit, exclusiveStartKey })

    return ok({
      users: users.map(u => ({
        userId: u.userId,
        email: u.email,
        orgId: u.orgId || null,
        orgRole: u.orgRole || null,
        mfaEnabled: u.mfaEnabled || false,
        createdAt: u.createdAt,
      })),
      nextCursor: encodeCursor(lastEvaluatedKey),
    })
  } catch (error) {
    const log = createRequestLogger('adminUsers', event)
    log.error({ err: error }, 'failed to list users')
    return err(500, 'Failed to list users')
  }
}
