import { checkBudget } from '../lib/snaptradeBudget.mjs'
import { requireAuth } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /api/snaptrade/budget
 *
 * Returns current SnapTrade API usage and budget status for the month.
 */
export async function handler(event) {
  try {
    const { error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const budget = await checkBudget()
    return ok(budget)
  } catch (error) {
    const log = createRequestLogger('snaptradeBudget', event)
    log.error({ err: error }, 'SnapTrade budget check failed')
    return err(500, 'An internal error occurred')
  }
}
