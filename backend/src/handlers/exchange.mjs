import { getPlaidClient } from '../lib/plaid.mjs'
import { putPlaidItem } from '../lib/dynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'

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
    const userId = user.orgId

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
        console.warn('Could not fetch institution name:', e.message)
      }
    }

    // Store in DynamoDB
    await putPlaidItem({
      userId,
      itemId: item_id,
      accessToken: access_token,
      institutionId,
      institutionName,
    })

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

    return ok({
      itemId: item_id,
      institutionName,
      institutionId,
      accounts,
    })
  } catch (error) {
    console.error('exchange error:', error.response?.data || error.message)
    return err(500, error.response?.data?.error_message || error.message)
  }
}
