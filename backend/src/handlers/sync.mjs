import { getPlaidClient } from '../lib/plaid.mjs'
import { getPlaidItemsByUser, getPlaidItem, updateCursor } from '../lib/dynamo.mjs'
import { readDataJson, writeDataJson, readAccountsCache, writeAccountsCache } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'
import {
  MAX_SYNC_PAGES,
  checkBudget,
  checkCooldown,
  recordSyncTime,
  PlaidBudgetExceededError,
  PlaidSyncCooldownError,
} from '../lib/plaidBudget.mjs'
import { mergeTransactionsIntoStatements } from '../lib/plaidStatements.mjs'

/**
 * POST /plaid/sync
 *
 * Syncs transactions and account balances from all connected Plaid items.
 * Updates data.json in S3 with fresh balances scoped to the user's org.
 *
 * Body: { itemId? }
 *   If itemId is provided, only syncs that single item.
 *   Otherwise syncs all items for the org.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { itemId } = body
    const userId = user.orgId

    const client = getPlaidClient()

    // Determine which items to sync
    let items
    if (itemId) {
      const item = await getPlaidItem(userId, itemId)
      if (!item) return err(404, 'Item not found')
      items = [item]
    } else {
      items = await getPlaidItemsByUser(userId)
    }

    if (items.length === 0) {
      return ok({ message: 'No connected accounts', updated: false })
    }

    // ── Budget guard: reject early if monthly limit already hit ──
    const budget = await checkBudget()
    if (!budget.allowed) {
      return err(429, `Monthly Plaid API budget exhausted (${budget.used}/${budget.limit} calls). Resets ${budget.month}-01.`)
    }

    // ── Cooldown guard: prevent rapid re-syncs per item ──
    for (const item of items) {
      const cooldown = await checkCooldown(item.itemId)
      if (!cooldown.allowed) {
        const waitSec = Math.ceil(cooldown.waitMs / 1000)
        return err(429, `Sync cooldown: please wait ${waitSec}s before syncing ${item.institutionName || item.itemId} again.`)
      }
    }

    // Read current data.json (scoped to org)
    let data = await readDataJson(user.orgId)
    if (!data || !data.state) {
      return err(400, 'No existing data.json found in S3. Please save data from the app first.')
    }

    const state = data.state
    if (!state.savingsAccounts) state.savingsAccounts = []
    if (!state.creditCards)     state.creditCards = []
    if (!data.plaidMeta)        data.plaidMeta = {}

    const allAccountUpdates = []
    // Collect per-item transaction data for statement generation
    const itemSyncData = []

    for (const item of items) {
      const { accessToken, itemId: iid } = item

      // ── Sync transactions (cursor-based, page-limited) ──
      let cursor = item.cursor || null
      let hasMore = true
      let addedTxns = []
      let modifiedTxns = []
      let removedTxns = []
      let pageCount = 0

      while (hasMore && pageCount < MAX_SYNC_PAGES) {
        pageCount++
        const syncRes = await client.transactionsSync({
          access_token: accessToken,
          cursor:       cursor || undefined,
          count:        500,
        })
        const syncData = syncRes.data

        addedTxns    = addedTxns.concat(syncData.added || [])
        modifiedTxns = modifiedTxns.concat(syncData.modified || [])
        removedTxns  = removedTxns.concat(syncData.removed || [])

        hasMore = syncData.has_more
        cursor  = syncData.next_cursor
      }

      if (hasMore) {
        const log = createRequestLogger('sync', event)
        log.warn({ itemId: iid, pageLimit: MAX_SYNC_PAGES }, 'sync hit page limit, remaining data will sync on next call')
      }

      // Persist the cursor for next incremental sync
      if (cursor) {
        await updateCursor(userId, iid, cursor)
      }

      // ── Fetch current account balances ──
      const acctRes = await client.accountsGet({ access_token: accessToken })
      const plaidAccounts = acctRes.data.accounts

      for (const acct of plaidAccounts) {
        const update = {
          plaidAccountId:   acct.account_id,
          plaidItemId:      iid,
          institutionName:  item.institutionName,
          name:             acct.name,
          officialName:     acct.official_name,
          type:             acct.type,
          subtype:          acct.subtype,
          mask:             acct.mask,
          currentBalance:   acct.balances.current,
          availableBalance: acct.balances.available,
          limit:            acct.balances.limit,
        }
        allAccountUpdates.push(update)

        // ── Map to existing data model ──
        if (acct.type === 'depository') {
          mapToSavingsAccount(state, data.plaidMeta, acct)
        } else if (acct.type === 'credit') {
          mapToCreditCard(state, data.plaidMeta, acct)
        }
      }

      // Stash per-item data for statement generation
      itemSyncData.push({
        item,
        addedTxns,
        modifiedTxns,
        removedTxns,
        plaidAccounts,
      })
    }

    // Record sync timestamp
    data.plaidMeta.lastSync = new Date().toISOString()
    data.savedAt = new Date().toISOString()

    // Write updated data back to S3 (scoped to org)
    await writeDataJson(data, user.orgId)

    // ── Persist transactions as hub statements ──
    let totalTxnsSynced = 0
    let totalTxnsRemoved = 0

    // Build cardId map once (state is now fully updated with plaidAccountIds)
    const cardIdMap = {}
    for (const card of state.creditCards) {
      if (card.plaidAccountId) cardIdMap[card.plaidAccountId] = card.id
    }
    for (const acct of state.savingsAccounts) {
      if (acct.plaidAccountId) cardIdMap[acct.plaidAccountId] = acct.id
    }

    for (const { item, addedTxns, modifiedTxns, removedTxns, plaidAccounts } of itemSyncData) {
      const accountInfoMap = {}
      for (const acct of plaidAccounts) {
        accountInfoMap[acct.account_id] = {
          name:            acct.name,
          mask:            acct.mask,
          type:            acct.type,
          subtype:         acct.subtype,
          institutionName: item.institutionName,
        }
      }

      if (addedTxns.length > 0 || modifiedTxns.length > 0 || removedTxns.length > 0) {
        await mergeTransactionsIntoStatements(
          user.orgId, addedTxns, modifiedTxns, removedTxns, accountInfoMap, cardIdMap
        )
        totalTxnsSynced  += addedTxns.length + modifiedTxns.length
        totalTxnsRemoved += removedTxns.length
      }
    }

    // Record cooldown for each synced item
    for (const item of items) {
      await recordSyncTime(item.itemId)
    }

    // ── Refresh accounts cache so /plaid/accounts never needs to call Plaid ──
    // We already have the fresh account data from accountsGet() above; persist it.
    // If only a subset of items was synced, we need to merge with the existing
    // cached items for the items we didn't touch in this sync.
    const syncedItemIds = new Set(items.map(i => i.itemId))
    try {
      const existing = await readAccountsCache(user.orgId)
      const existingItems = (existing?.items || []).filter(ci => !syncedItemIds.has(ci.itemId))

      // Build fresh entries for the items we just synced
      const freshItems = itemSyncData.map(({ item, plaidAccounts }) => ({
        itemId:          item.itemId,
        institutionName: item.institutionName,
        institutionId:   item.institutionId,
        connectedBy:     item.connectedBy || null,
        lastSync:        data.plaidMeta.lastSync,
        accounts: plaidAccounts.map(acct => ({
          id:               acct.account_id,
          name:             acct.name,
          officialName:     acct.official_name,
          type:             acct.type,
          subtype:          acct.subtype,
          mask:             acct.mask,
          currentBalance:   acct.balances.current,
          availableBalance: acct.balances.available,
          limit:            acct.balances.limit,
        })),
      }))

      await writeAccountsCache(user.orgId, [...existingItems, ...freshItems])
    } catch (cacheErr) {
      // Non-fatal: cache write failure shouldn't abort the sync response
      const log = createRequestLogger('sync', event)
      log.warn({ err: cacheErr }, 'failed to update accounts cache after sync')
    }

    return ok({
      updated: true,
      accountsUpdated: allAccountUpdates.length,
      transactionsSynced: totalTxnsSynced,
      transactionsRemoved: totalTxnsRemoved,
      accounts: allAccountUpdates,
      data,  // return full updated data so frontend can apply it
    })
  } catch (error) {
    // Return 429 for budget errors so the frontend can show a clear message
    const log = createRequestLogger('sync', event)
    if (error instanceof PlaidBudgetExceededError) {
      log.warn({ err: error }, 'budget exceeded during sync')
      return err(429, error.message)
    }
    log.error({ err: error, plaidError: error.response?.data }, 'sync failed')
    return err(500, error.response?.data?.error_message || error.message)
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/**
 * Map a Plaid depository account to a savingsAccounts[] entry.
 * First tries to match by stored plaidAccountId, then by similar name.
 * Creates a new entry if no match found.
 */
function mapToSavingsAccount(state, plaidMeta, plaidAcct) {
  const plaidId = plaidAcct.account_id
  const balance = plaidAcct.balances.available ?? plaidAcct.balances.current ?? 0

  // 1. Match by plaidAccountId
  let existing = state.savingsAccounts.find(a => a.plaidAccountId === plaidId)

  // 2. Match by name (first time linking)
  if (!existing) {
    const plaidName = (plaidAcct.official_name || plaidAcct.name || '').toLowerCase()
    existing = state.savingsAccounts.find(a =>
      !a.plaidAccountId && a.name && plaidName.includes(a.name.toLowerCase())
    )
  }

  if (existing) {
    existing.amount = Math.round(balance * 100) / 100
    existing.plaidAccountId = plaidId
    existing.plaidLastSync  = new Date().toISOString()
    if (plaidAcct.subtype) existing.plaidSubtype = plaidAcct.subtype
  } else {
    // Create new entry
    const displayName = plaidAcct.official_name || plaidAcct.name || 'Linked Account'
    const subtypeLabel = plaidAcct.subtype
      ? ` (${plaidAcct.subtype.charAt(0).toUpperCase() + plaidAcct.subtype.slice(1)})`
      : ''

    state.savingsAccounts.push({
      id:              Date.now() + Math.random(),
      name:            `${displayName}${subtypeLabel}`,
      amount:          Math.round(balance * 100) / 100,
      active:          true,
      assignedTo:      null,
      plaidAccountId:  plaidId,
      plaidLastSync:   new Date().toISOString(),
      plaidSubtype:    plaidAcct.subtype || null,
    })
  }
}

/**
 * Map a Plaid credit account to a creditCards[] entry.
 * Same matching logic: plaidAccountId first, then name, then create.
 */
function mapToCreditCard(state, plaidMeta, plaidAcct) {
  const plaidId = plaidAcct.account_id
  const balance = Math.abs(plaidAcct.balances.current ?? 0)
  const limit   = plaidAcct.balances.limit ?? 0

  // 1. Match by plaidAccountId
  let existing = state.creditCards.find(c => c.plaidAccountId === plaidId)

  // 2. Match by name
  if (!existing) {
    const plaidName = (plaidAcct.official_name || plaidAcct.name || '').toLowerCase()
    existing = state.creditCards.find(c =>
      !c.plaidAccountId && c.name && plaidName.includes(c.name.toLowerCase())
    )
  }

  if (existing) {
    existing.balance     = Math.round(balance * 100) / 100
    existing.creditLimit = Math.round(limit * 100) / 100
    existing.plaidAccountId = plaidId
    existing.plaidLastSync  = new Date().toISOString()
  } else {
    const displayName = plaidAcct.official_name || plaidAcct.name || 'Linked Card'
    state.creditCards.push({
      id:              Date.now() + Math.random(),
      name:            displayName,
      balance:         Math.round(balance * 100) / 100,
      minimumPayment:  0,
      creditLimit:     Math.round(limit * 100) / 100,
      apr:             0,
      statementCloseDay: '',
      assignedTo:      null,
      plaidAccountId:  plaidId,
      plaidLastSync:   new Date().toISOString(),
    })
  }
}
