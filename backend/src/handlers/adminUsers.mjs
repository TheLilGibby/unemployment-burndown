import { requireSuperAdmin } from '../lib/auth.mjs'
import { listAllUsers } from '../lib/users.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * GET /api/admin/users
 * Superadmin-only: list all users (without sensitive fields).
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const audit = createAuditLogger('admin:listUsers', event)
    audit.info({ adminUserId: user.sub }, 'superadmin listed all users')

    const users = await listAllUsers()

    return ok({
      users: users.map(u => ({
        userId: u.userId,
        email: u.email,
        orgId: u.orgId || null,
        orgRole: u.orgRole || null,
        mfaEnabled: u.mfaEnabled || false,
        createdAt: u.createdAt,
      })),
    })
  } catch (error) {
    const log = createRequestLogger('adminUsers', event)
    log.error({ err: error }, 'failed to list users')
    return err(500, 'Failed to list users')
  }
}
