import { requireSuperAdmin } from '../lib/auth.mjs'
import { getLimits, setLimits } from '../lib/plaidBudget.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

/**
 * GET /api/admin/plaid-limits
 *
 * Superadmin-only: retrieve current Plaid API limit configuration.
 */
export async function getHandler(event) {
  try {
    const { error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const limits = await getLimits()
    return ok(limits)
  } catch (error) {
    const log = createRequestLogger('adminPlaidLimits:get', event)
    log.error({ err: error }, 'failed to get Plaid limits')
    return err(500, 'Failed to get Plaid limits')
  }
}

/**
 * PUT /api/admin/plaid-limits
 *
 * Superadmin-only: update Plaid API limit configuration.
 * Accepts partial updates: { monthlyBudget, estCostPerCall, maxSyncPages, syncCooldownSeconds }
 */
export async function putHandler(event) {
  try {
    const { user, error: authErr } = requireSuperAdmin(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const audit = createAuditLogger('admin:updatePlaidLimits', event)

    // Validate inputs
    const updates = {}
    if (body.monthlyBudget !== undefined) {
      const val = parseFloat(body.monthlyBudget)
      if (isNaN(val) || val < 0 || val > 10000) return err(400, 'monthlyBudget must be between 0 and 10000')
      updates.monthlyBudget = val
    }
    if (body.estCostPerCall !== undefined) {
      const val = parseFloat(body.estCostPerCall)
      if (isNaN(val) || val <= 0 || val > 100) return err(400, 'estCostPerCall must be between 0.01 and 100')
      updates.estCostPerCall = val
    }
    if (body.maxSyncPages !== undefined) {
      const val = parseInt(body.maxSyncPages, 10)
      if (isNaN(val) || val < 1 || val > 100) return err(400, 'maxSyncPages must be between 1 and 100')
      updates.maxSyncPages = val
    }
    if (body.syncCooldownSeconds !== undefined) {
      const val = parseInt(body.syncCooldownSeconds, 10)
      if (isNaN(val) || val < 0 || val > 86400) return err(400, 'syncCooldownSeconds must be between 0 and 86400')
      updates.syncCooldownSeconds = val
    }

    if (Object.keys(updates).length === 0) {
      return err(400, 'No valid fields to update')
    }

    const before = await getLimits()
    audit.warn(
      { adminUserId: user.sub, before, updates },
      'superadmin updating Plaid API limits'
    )

    const after = await setLimits(updates)

    return ok({ updated: true, before, after })
  } catch (error) {
    const log = createRequestLogger('adminPlaidLimits:put', event)
    log.error({ err: error }, 'failed to update Plaid limits')
    return err(500, 'Failed to update Plaid limits')
  }
}
