import { requireSuperAdmin } from '../lib/auth.mjs'
import { checkBudget, resetCallCount } from '../lib/plaidBudget.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * POST /api/admin/reset-plaid-budget
 *
 * Superadmin-only: reset the Plaid API call counter to 0 for the current month.
 * This is a one-time exception override for when the budget cap needs to be cleared.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const audit = createAuditLogger('admin:resetPlaidBudget', event)

    const before = await checkBudget()
    audit.warn(
      { adminUserId: user.sub, previousCount: before.used, limit: before.limit, month: before.month },
      'superadmin reset Plaid API budget counter to 0'
    )

    const month = await resetCallCount()
    const after = await checkBudget()

    return ok({
      reset: true,
      month,
      previousCount: before.used,
      ...after,
    })
  } catch (error) {
    const log = createRequestLogger('adminResetPlaidBudget', event)
    log.error({ err: error }, 'failed to reset Plaid budget')
    return err(500, 'Failed to reset Plaid budget')
  }
}
