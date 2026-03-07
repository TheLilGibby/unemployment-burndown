import { getPlaidClient } from '../lib/plaid.mjs'
import { putPlaidItem, getPlaidItemsByUser, deletePlaidItem, isValidAccessToken } from '../lib/dynamo.mjs'
import { readAccountsCache, writeAccountsCache } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /plaid/exchange
 *
 * Receives the temporary public_token from Plaid Link and exchanges it
 * for a permanent access_token. Stores the token in DynamoDB keyed by
 * orgId and returns the initial account list to the frontend.
 *
 * Body: { public_token, metadata? }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { public_token, metadata = {} }  = body
    const userId = user.sub

    if (!public_token) {
      return err(400, 'public_token is required')
    }

    const client = getPlaidClient()

    // Exchange public_token for permanent access_token
    const exchangeRes = await client.itemPublicTokenExchange({ public_token })
    const { access_token, item_id } = exchangeRes.data

    // Fetch institution info
    let institutionName = metadata.institution?.name || null
    let institutionId   = metadata.institution?.institution_id || null

    if (!institutionName) {
      try {
        const itemRes = await client.itemGet({ access_token })
        institutionId = itemRes.data.item.institution_id
        if (institutionId) {
          const instRes = await client.institutionsGetById({
            institution_id: institutionId,
            country_codes: ['US'],
          })
          institutionName = instRes.data.institution.name
        }
      } catch (e) {
        const log = createRequestLogger('exchange', event)
        log.warn({ err: e }, 'could not fetch institution name')
      }
    }

    // Store in DynamoDB (track which user connected the account)
    await putPlaidItem({
      userId,
      itemId: item_id,
      accessToken: access_token,
      institutionId,
      institutionName,
      connectedBy: user.sub,
    })

    // ── Clean up stale items for the same institution ──
    // After a key rotation, old items have undecryptable tokens. If the user
    // reconnects the same bank, remove the stale entries automatically.
    let staleCleaned = []
    if (institutionId) {
      try {
        const existingItems = await getPlaidItemsByUser(userId)
        const staleItems = existingItems.filter(ei =>
          ei.institutionId === institutionId &&
          ei.itemId !== item_id &&
          !isValidAccessToken(ei.accessToken)
        )
        for (const stale of staleItems) {
          try {
            await client.itemRemove({ access_token: stale.accessToken })
          } catch (_) { /* token undecryptable — Plaid will reject, that's fine */ }
          await deletePlaidItem(userId, stale.itemId)
        }
        staleCleaned = staleItems.map(s => s.itemId)
        if (staleCleaned.length > 0) {
          const log = createRequestLogger('exchange', event)
          log.info({ staleCleaned, institutionId }, 'cleaned up stale items for same institution')
        }
      } catch (cleanupErr) {
        const log = createRequestLogger('exchange', event)
        log.warn({ err: cleanupErr }, 'failed to clean stale items during exchange')
      }
    }

    // Fetch initial accounts
    const accountsRes = await client.accountsGet({ access_token })
    const accounts = accountsRes.data.accounts.map(acct => ({
      id:             acct.account_id,
      name:           acct.name,
      officialName:   acct.official_name,
      type:           acct.type,
      subtype:        acct.subtype,
      mask:           acct.mask,
      currentBalance: acct.balances.current,
      availableBalance: acct.balances.available,
      limit:          acct.balances.limit,
      isoCurrencyCode: acct.balances.iso_currency_code,
    }))

    // ── Update accounts cache so /plaid/accounts stays free ──
    // Merge the new item into any existing cached items for this org.
    try {
      const existing = await readAccountsCache(userId)
      const otherItems = (existing?.items || []).filter(ci =>
        ci.itemId !== item_id && !staleCleaned.includes(ci.itemId)
      )
      const newItem = {
        itemId:          item_id,
        institutionName,
        institutionId,
        connectedBy:     user.sub,
        lastSync:        new Date().toISOString(),
        accounts,
      }
      await writeAccountsCache(userId, [...otherItems, newItem])
    } catch (cacheErr) {
      const log = createRequestLogger('exchange', event)
      log.warn({ err: cacheErr }, 'failed to update accounts cache after exchange')
    }

    return ok({
      itemId: item_id,
      institutionName,
      institutionId,
      connectedBy: user.sub,
      accounts,
    })
  } catch (error) {
    const log = createRequestLogger('exchange', event)
    log.error({ err: error, plaidError: error.response?.data }, 'token exchange failed')
    return err(500, error.response?.data?.error_message || error.message)
  }
}
