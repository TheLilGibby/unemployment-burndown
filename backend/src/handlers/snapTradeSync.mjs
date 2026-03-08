import { getSnapTradeClient } from '../lib/snaptrade.mjs'
import { getSnapTradeUser, getSnapTradeConnectionsByUser, getSnapTradeConnection } from '../lib/snapTradeDynamo.mjs'
import { checkBudget, checkCooldown, recordSyncTime } from '../lib/snaptradeBudget.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { readDataJson, writeDataJson } from '../lib/s3.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /snaptrade/sync
 *
 * Fetches holdings + balances from SnapTrade and maps them into the
 * state.investments[] array in data.json. Mirrors the Plaid sync pattern.
 *
 * Body: { connectionId? } (optional — syncs all connections if omitted)
 */
export async function handler(event) {
  const log = createRequestLogger('snapTradeSync', event)

  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { connectionId } = body
    const orgId = user.orgId

    const stUser = await getSnapTradeUser(orgId)
    if (!stUser) return err(400, 'SnapTrade user not registered')

    // Budget guard
    const budget = await checkBudget()
    if (!budget.allowed) {
      return err(429, `Monthly SnapTrade API budget exhausted (${budget.used}/${budget.limit} calls). Resets next month.`)
    }

    // Determine which connections to sync
    let connections
    if (connectionId) {
      const conn = await getSnapTradeConnection(orgId, connectionId)
      if (!conn) return err(404, 'Connection not found')
      connections = [conn]
    } else {
      connections = await getSnapTradeConnectionsByUser(orgId)
    }

    if (connections.length === 0) return ok({ updated: false, message: 'No connections to sync' })

    // Cooldown check
    for (const conn of connections) {
      const cooldown = await checkCooldown(`st_conn_${conn.connectionId}`)
      if (!cooldown.allowed) {
        const waitSec = Math.ceil(cooldown.waitMs / 1000)
        return err(429, `Sync cooldown: please wait ${waitSec} seconds before syncing again.`)
      }
    }

    // Read current data.json
    let data = await readDataJson(orgId)
    if (!data || !data.state) return err(400, 'No existing data found. Please set up your profile first.')

    const state = data.state
    if (!state.investments) state.investments = []
    if (!data.snapTradeMeta) data.snapTradeMeta = {}

    const client = getSnapTradeClient()

    // Fetch all accounts for this user
    const accountsRes = await client.accountInformation.listUserAccounts({
      userId: stUser.snapTradeUserId,
      userSecret: stUser.userSecret,
    })
    const allAccounts = accountsRes.data || []

    // Fetch all holdings for this user
    const holdingsRes = await client.accountInformation.getAllUserHoldings({
      userId: stUser.snapTradeUserId,
      userSecret: stUser.userSecret,
    })
    const allHoldings = holdingsRes.data || []

    // Group holdings by account
    const accountMap = new Map()
    for (const acct of allAccounts) {
      accountMap.set(acct.id, { ...acct, holdings: [] })
    }
    for (const holding of allHoldings) {
      const acctId = holding.account?.id
      if (acctId && accountMap.has(acctId)) {
        accountMap.get(acctId).holdings.push(holding)
      }
    }

    // Filter to only accounts from the connections we're syncing
    const syncConnIds = new Set(connections.map(c => c.connectionId))
    let accountsUpdated = 0

    for (const [acctId, acctData] of accountMap) {
      const connId = acctData.brokerage_authorization?.id || acctData.brokerage_authorization
      if (!syncConnIds.has(connId)) continue

      const totalValue = acctData.balance?.total?.amount ?? 0
      mapToInvestment(state, acctData, totalValue, connId)
      accountsUpdated++
    }

    // Update meta
    data.snapTradeMeta.lastSync = new Date().toISOString()
    data.savedAt = new Date().toISOString()

    // Write back to S3
    await writeDataJson(data, orgId)

    // Record cooldown
    for (const conn of connections) {
      await recordSyncTime(`st_conn_${conn.connectionId}`)
    }

    log.info({ orgId, accountsUpdated }, 'SnapTrade sync completed')
    return ok({ updated: true, accountsUpdated, data })
  } catch (error) {
    log.error({ err: error }, 'SnapTrade sync failed')
    return err(500, 'An internal error occurred')
  }
}

function mapToInvestment(state, acctData, totalValue, connectionId) {
  const snapTradeAccountId = acctData.id

  // 1. Match by snapTradeAccountId
  let existing = state.investments.find(i => i.snapTradeAccountId === snapTradeAccountId)

  // 2. Match by name (first-time linking)
  if (!existing) {
    const stName = (acctData.name || '').toLowerCase()
    existing = state.investments.find(i =>
      !i.snapTradeAccountId && i.name && stName.includes(i.name.toLowerCase())
    )
  }

  const holdings = (acctData.holdings || []).map(h => ({
    symbol: h.symbol?.symbol || h.symbol?.description || 'Unknown',
    units: h.units ?? 0,
    price: h.price ?? 0,
    value: (h.units || 0) * (h.price || 0),
    currency: h.currency?.code || 'USD',
  }))

  if (existing) {
    existing.balance = Math.round(totalValue * 100) / 100
    existing.snapTradeAccountId = snapTradeAccountId
    existing.snapTradeConnectionId = connectionId
    existing.snapTradeLastSync = new Date().toISOString()
    existing.holdings = holdings
  } else {
    state.investments.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: acctData.name || 'Linked Investment Account',
      balance: Math.round(totalValue * 100) / 100,
      monthlyContribution: 0,
      active: true,
      assignedTo: null,
      snapTradeAccountId,
      snapTradeConnectionId: connectionId,
      snapTradeLastSync: new Date().toISOString(),
      holdings,
    })
  }
}
