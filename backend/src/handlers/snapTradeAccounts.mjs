import { getSnapTradeClient } from '../lib/snaptrade.mjs'
import { getSnapTradeUser, getSnapTradeConnectionsByUser } from '../lib/snapTradeDynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /snaptrade/accounts
 *
 * Lists all connected SnapTrade brokerage connections and their accounts.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const orgId = user.orgId
    const stUser = await getSnapTradeUser(orgId)
    if (!stUser) return ok({ connections: [] })

    const connections = await getSnapTradeConnectionsByUser(orgId)
    if (connections.length === 0) return ok({ connections: [] })

    const client = getSnapTradeClient()

    // Fetch all accounts for this SnapTrade user
    let allAccounts = []
    try {
      const acctRes = await client.accountInformation.listUserAccounts({
        userId: stUser.snapTradeUserId,
        userSecret: stUser.userSecret,
      })
      allAccounts = acctRes.data || []
    } catch (acctErr) {
      const log = createRequestLogger('snapTradeAccounts', event)
      log.warn({ err: acctErr }, 'Failed to fetch SnapTrade accounts')
    }

    const result = connections.map(conn => {
      const connAccounts = allAccounts.filter(
        a => a.brokerage_authorization === conn.connectionId ||
             a.brokerage_authorization?.id === conn.connectionId
      )
      return {
        connectionId: conn.connectionId,
        brokerageName: conn.brokerageName,
        accounts: connAccounts.map(a => ({
          id: a.id,
          name: a.name,
          number: a.number,
          type: a.institution_type || a.type,
          balance: a.balance?.total?.amount ?? null,
          currency: a.balance?.total?.currency || 'USD',
        })),
        lastSync: conn.updatedAt || conn.createdAt,
      }
    })

    return ok({ connections: result })
  } catch (error) {
    const log = createRequestLogger('snapTradeAccounts', event)
    log.error({ err: error }, 'SnapTrade accounts fetch failed')
    return err(500, 'An internal error occurred')
  }
}
