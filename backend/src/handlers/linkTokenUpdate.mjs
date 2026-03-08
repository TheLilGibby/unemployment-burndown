import { CountryCode } from 'plaid'
import { getPlaidClient } from '../lib/plaid.mjs'
import { getPlaidItemsByUser } from '../lib/dynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /plaid/link-token/update
 *
 * Creates a link_token in update mode for an existing Plaid item.
 * This allows the user to re-authenticate (e.g. after credentials expire)
 * without disconnecting and losing transaction history.
 *
 * Body: { itemId: string }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { itemId } = body

    if (!itemId) {
      return err(400, 'itemId is required')
    }

    // Look up the item to get the access_token
    const items = await getPlaidItemsByUser(user.sub)
    const item = items.find(i => i.itemId === itemId)

    if (!item) {
      return err(404, 'Item not found')
    }

    if (!item.accessToken) {
      return err(400, 'Item has no access token — disconnect and reconnect instead')
    }

    const client = getPlaidClient()

    const params = {
      user:           { client_user_id: user.sub },
      client_name:    'Burndown Tracker',
      access_token:   item.accessToken,
      country_codes:  [CountryCode.Us],
      language:       'en',
    }

    if (process.env.PLAID_WEBHOOK_URL) {
      params.webhook = process.env.PLAID_WEBHOOK_URL
    }

    const response = await client.linkTokenCreate(params)

    return ok({ link_token: response.data.link_token })
  } catch (error) {
    const log = createRequestLogger('linkTokenUpdate', event)
    log.error({ err: error, plaidError: error.response?.data }, 'update link token creation failed')
    return err(500, 'Failed to create update link token')
  }
}
