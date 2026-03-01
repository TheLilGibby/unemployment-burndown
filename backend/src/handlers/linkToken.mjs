import { CountryCode, Products } from 'plaid'
import { getPlaidClient } from '../lib/plaid.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'

/**
 * POST /plaid/link-token
 *
 * Creates a short-lived link_token that the React frontend uses to open
 * Plaid Link. Uses the orgId as the Plaid client_user_id so all org
 * members share the same Plaid items.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const client = getPlaidClient()

    const response = await client.linkTokenCreate({
      user:           { client_user_id: user.orgId },
      client_name:    'Burndown Tracker',
      products:       [Products.Transactions],
      country_codes:  [CountryCode.Us],
      language:       'en',
    })

    return ok({ link_token: response.data.link_token })
  } catch (error) {
    console.error('linkToken error:', error.response?.data || error.message)
    return err(500, error.response?.data?.error_message || error.message)
  }
}
