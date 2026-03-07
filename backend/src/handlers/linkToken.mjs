import { CountryCode, Products } from 'plaid'
import { getPlaidClient } from '../lib/plaid.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /plaid/link-token
 *
 * Creates a short-lived link_token that the React frontend uses to open
 * Plaid Link. Uses the user's sub as the Plaid client_user_id so each
 * user has their own Plaid items.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const client = getPlaidClient()

    const response = await client.linkTokenCreate({
      user:           { client_user_id: user.sub },
      client_name:    'Burndown Tracker',
      products:       [Products.Transactions],
      transactions:   { days_requested: 1461 },
      country_codes:  [CountryCode.Us],
      language:       'en',
    })

    return ok({ link_token: response.data.link_token })
  } catch (error) {
    const log = createRequestLogger('linkToken', event)
    log.error({ err: error, plaidError: error.response?.data }, 'link token creation failed')
    return err(500, error.response?.data?.error_message || error.message)
  }
}
