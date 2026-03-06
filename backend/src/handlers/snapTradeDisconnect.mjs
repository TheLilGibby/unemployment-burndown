import { getSnapTradeClient } from '../lib/snaptrade.mjs'
import { getSnapTradeUser, deleteSnapTradeConnection } from '../lib/snapTradeDynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /snaptrade/disconnect
 *
 * Removes a connected SnapTrade brokerage. Revokes the authorization
 * with SnapTrade and deletes the record from DynamoDB.
 *
 * Body: { connectionId }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { connectionId } = body
    if (!connectionId) return err(400, 'connectionId is required')

    const orgId = user.orgId
    const stUser = await getSnapTradeUser(orgId)

    // Revoke with SnapTrade API
    if (stUser) {
      try {
        const client = getSnapTradeClient()
        await client.connections.removeBrokerageAuthorization({
          authorizationId: connectionId,
          userId: stUser.snapTradeUserId,
          userSecret: stUser.userSecret,
        })
      } catch (stErr) {
        const log = createRequestLogger('snapTradeDisconnect', event)
        log.warn({ err: stErr, connectionId }, 'SnapTrade connection removal failed, proceeding with local deletion')
      }
    }

    // Delete from DynamoDB
    await deleteSnapTradeConnection(orgId, connectionId)

    return ok({ success: true, connectionId })
  } catch (error) {
    const log = createRequestLogger('snapTradeDisconnect', event)
    log.error({ err: error }, 'SnapTrade disconnect failed')
    return err(500, error.message)
  }
}
