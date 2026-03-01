import { getPlaidClient } from '../lib/plaid.mjs'
import { getPlaidItem, deletePlaidItem } from '../lib/dynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /plaid/disconnect
 *
 * Removes a connected Plaid item. Revokes the access_token with Plaid
 * and deletes the record from DynamoDB. Scoped to the user's org.
 *
 * Body: { itemId }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { itemId } = body
    const userId = user.orgId

    if (!itemId) {
      return err(400, 'itemId is required')
    }

    const item = await getPlaidItem(userId, itemId)
    if (!item) {
      return err(404, 'Item not found')
    }

    // Revoke the access token with Plaid
    try {
      const client = getPlaidClient()
      await client.itemRemove({ access_token: item.accessToken })
    } catch (plaidErr) {
      // If Plaid call fails (e.g. token already invalid), still delete locally
      const log = createRequestLogger('disconnect', event)
      log.warn({ err: plaidErr, itemId }, 'Plaid itemRemove failed, proceeding with local deletion')
    }

    // Delete from DynamoDB
    await deletePlaidItem(userId, itemId)

    return ok({ success: true, itemId })
  } catch (error) {
    const log = createRequestLogger('disconnect', event)
    log.error({ err: error, plaidError: error.response?.data }, 'disconnect failed')
    return err(500, error.response?.data?.error_message || error.message)
  }
}
