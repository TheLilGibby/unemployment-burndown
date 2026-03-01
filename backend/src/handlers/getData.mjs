import { readDataJson, writeDataJson } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * Checks whether data.json is essentially empty (no financial data).
 * This happens when an org was created before legacy data migration.
 */
function isEmptyData(data) {
  if (!data || !data.state) return true
  const s = data.state
  const hasAccounts = (s.savingsAccounts && s.savingsAccounts.length > 0)
  const hasExpenses = (s.expenses && s.expenses.length > 0)
  const hasIncome = (s.monthlyIncome && (Array.isArray(s.monthlyIncome) ? s.monthlyIncome.length > 0 : s.monthlyIncome > 0))
  return !hasAccounts && !hasExpenses && !hasIncome
}

/**
 * GET /api/data
 * Reads data.json from S3 scoped to the user's org.
 * Falls back to legacy root data.json if org data is empty (pre-migration).
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    let data = await readDataJson(user.orgId)

    // If the org's data is empty/missing, check for legacy root data.json
    // and auto-migrate it into the org path.
    if (isEmptyData(data)) {
      const legacyData = await readDataJson(null)
      if (legacyData && !isEmptyData(legacyData)) {
        const log = createRequestLogger('getData', event)
        log.info({ orgId: user.orgId }, 'auto-migrating legacy root data.json into org')
        legacyData.savedAt = new Date().toISOString()
        await writeDataJson(legacyData, user.orgId)
        data = legacyData
      }
    }

    if (!data) {
      return ok(null)
    }
    return ok(data)
  } catch (error) {
    const log = createRequestLogger('getData', event)
    log.error({ err: error }, 'failed to read data')
    return err(500, error.message)
  }
}
