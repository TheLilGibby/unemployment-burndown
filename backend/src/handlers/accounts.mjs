import { getPlaidClient } from '../lib/plaid.mjs'
import { getPlaidItemsByUser } from '../lib/dynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /plaid/accounts
 *
 * Lists all connected Plaid items and their accounts with current balances.
 * Scoped to the user's org.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const userId = user.orgId
    const client = getPlaidClient()

    const items = await getPlaidItemsByUser(userId)

    if (items.length === 0) {
      return ok({ items: [] })
    }

    const result = []

    for (const item of items) {
      try {
        const acctRes = await client.accountsGet({ access_token: item.accessToken })
        const accounts = acctRes.data.accounts.map(acct => ({
          id:               acct.account_id,
          name:             acct.name,
          officialName:     acct.official_name,
          type:             acct.type,
          subtype:          acct.subtype,
          mask:             acct.mask,
          currentBalance:   acct.balances.current,
          availableBalance: acct.balances.available,
          limit:            acct.balances.limit,
        }))

        result.push({
          itemId:          item.itemId,
          institutionName: item.institutionName,
          institutionId:   item.institutionId,
          accounts,
          lastSync:        item.updatedAt || item.createdAt,
        })
      } catch (acctErr) {
        // If a single item fails (e.g. token expired), include it with error
        const log = createRequestLogger('accounts', event)
        log.warn({ err: acctErr, itemId: item.itemId }, 'failed to fetch accounts for item')
        result.push({
          itemId:          item.itemId,
          institutionName: item.institutionName,
          institutionId:   item.institutionId,
          accounts:        [],
          error:           acctErr.response?.data?.error_message || acctErr.message,
          lastSync:        item.updatedAt || item.createdAt,
        })
      }
    }

    return ok({ items: result })
  } catch (error) {
    const log = createRequestLogger('accounts', event)
    log.error({ err: error, plaidError: error.response?.data }, 'accounts fetch failed')
    return err(500, error.response?.data?.error_message || error.message)
  }
}
