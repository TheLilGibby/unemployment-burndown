import { checkBudget } from '../lib/plaidBudget.mjs'
import { requireAuth } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'

/**
 * GET /plaid/budget
 *
 * Returns current Plaid API usage and budget status for the month.
 */
export async function handler(event) {
  try {
    const { error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const budget = await checkBudget()
    return ok(budget)
  } catch (error) {
    console.error('budget check error:', error.message)
    return err(500, error.message)
  }
}
