import { requireSuperAdmin, signToken } from '../lib/auth.mjs'
import { getUser } from '../lib/users.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * POST /api/admin/impersonate
 * Body: { targetUserId }
 * Superadmin-only: generate a token to impersonate the target user.
 */
export async function handler(event) {
  try {
    const { user: adminUser, error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { targetUserId } = body
    if (!targetUserId) return err(400, 'targetUserId is required')

    const targetUser = await getUser(targetUserId)
    if (!targetUser) return err(404, 'Target user not found')

    const audit = createAuditLogger('admin:impersonate', event)
    audit.warn(
      { adminUserId: adminUser.sub, targetUserId, targetOrgId: targetUser.orgId },
      'superadmin started impersonation session',
    )

    const impersonationToken = signToken(targetUser.userId, {
      mfaVerified: true,
      orgId: targetUser.orgId || null,
      orgRole: targetUser.orgRole || null,
      isSuperAdmin: false,
      impersonatedBy: adminUser.sub,
    })

    return ok({
      token: impersonationToken,
      user: {
        userId: targetUser.userId,
        email: targetUser.email,
        orgId: targetUser.orgId || null,
        orgRole: targetUser.orgRole || null,
        mfaEnabled: targetUser.mfaEnabled,
      },
    })
  } catch (error) {
    const log = createRequestLogger('adminImpersonate', event)
    log.error({ err: error }, 'failed to start impersonation')
    return err(500, 'Failed to start impersonation')
  }
}
