import { getPlaidClient } from '../lib/plaid.mjs'
import { getPlaidItemsByUser, isValidAccessToken } from '../lib/dynamo.mjs'
import { readAccountsCache, writeAccountsCache } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /plaid/accounts
 *
 * Lists all connected Plaid items and their accounts with current balances.
 * Scoped to the user's org.
 *
 * Serves from an S3 cache (written by sync and exchange handlers) to avoid
 * burning Plaid API calls on every page load. Falls back to a live Plaid call
 * only when no cache exists (i.e. right after the very first bank connection).
 *
 * Add ?force=true to bypass the cache and refresh from Plaid directly.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const userId = user.sub
    const force  = event.queryStringParameters?.force === 'true'

    // ── Try S3 cache first (unless caller forces a refresh) ──
    if (!force) {
      const cache = await readAccountsCache(userId)
      if (cache?.items) {
        return ok({ items: cache.items, cachedAt: cache.cachedAt, fromCache: true })
      }
    }

    // ── Cache miss or forced refresh: call Plaid and populate cache ──
    const log = createRequestLogger('accounts', event)
    log.info({ force }, 'accounts cache miss — fetching live from Plaid')

    const client = getPlaidClient()
    const items  = await getPlaidItemsByUser(userId)

    if (items.length === 0) {
      return ok({ items: [] })
    }

    const result = []

    for (const item of items) {
      try {
        if (!isValidAccessToken(item.accessToken)) {
          log.warn({ itemId: item.itemId }, 'skipping item with invalid access token (encrypted/corrupt or PLAID_ENV mismatch)')
          result.push({
            itemId:          item.itemId,
            institutionName: item.institutionName,
            institutionId:   item.institutionId,
            connectedBy:     item.connectedBy || null,
            accounts:        [],
            error:           'Access token is invalid. Try disconnecting and reconnecting this bank account.',
            lastSync:        item.updatedAt || item.createdAt,
          })
          continue
        }
        const acctRes  = await client.accountsGet({ access_token: item.accessToken })
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
          connectedBy:     item.connectedBy || null,
          accounts,
          lastSync:        item.updatedAt || item.createdAt,
        })
      } catch (acctErr) {
        log.warn({ err: acctErr, itemId: item.itemId }, 'failed to fetch accounts for item')
        result.push({
          itemId:          item.itemId,
          institutionName: item.institutionName,
          institutionId:   item.institutionId,
          connectedBy:     item.connectedBy || null,
          accounts:        [],
          error:           'Failed to fetch accounts for this connection. Try disconnecting and reconnecting.',
          lastSync:        item.updatedAt || item.createdAt,
        })
      }
    }

    // Only cache if all items succeeded — error items would be served
    // indefinitely from cache even after the underlying issue is resolved.
    const hasErrors = result.some(item => item.error)
    if (!hasErrors) {
      await writeAccountsCache(userId, result)
    } else {
      log.info({ errorCount: result.filter(i => i.error).length }, 'skipping cache write — some items have errors')
    }

    return ok({ items: result, fromCache: false })
  } catch (error) {
    const log = createRequestLogger('accounts', event)
    log.error({ err: error, plaidError: error.response?.data }, 'accounts fetch failed')
    return err(500, 'An internal error occurred')
  }
}
