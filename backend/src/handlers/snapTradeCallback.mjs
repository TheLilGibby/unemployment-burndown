import { getSnapTradeClient } from '../lib/snaptrade.mjs'
import { getSnapTradeUser, putSnapTradeConnection } from '../lib/snapTradeDynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /snaptrade/callback
 *
 * Called by the frontend after the user completes the SnapTrade portal.
 * Stores the new brokerage connection in DynamoDB.
 *
 * Body: { authorizationId }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { authorizationId } = body
    if (!authorizationId) return err(400, 'authorizationId is required')

    const orgId = user.orgId
    const stUser = await getSnapTradeUser(orgId)
    if (!stUser) return err(400, 'SnapTrade user not registered')

    const client = getSnapTradeClient()

    // Fetch connection details from SnapTrade
    let brokerageName = 'Connected Brokerage'
    try {
      const connRes = await client.connections.detailBrokerageAuthorization({
        authorizationId,
        userId: stUser.snapTradeUserId,
        userSecret: stUser.userSecret,
      })
      brokerageName = connRes.data?.brokerage?.name || brokerageName
    } catch (detailErr) {
      const log = createRequestLogger('snapTradeCallback', event)
      log.warn({ err: detailErr, authorizationId }, 'Could not fetch connection details, using default name')
    }

    await putSnapTradeConnection({
      userId: orgId,
      connectionId: authorizationId,
      brokerageName,
    })

    return ok({ connectionId: authorizationId, brokerageName })
  } catch (error) {
    const log = createRequestLogger('snapTradeCallback', event)
    log.error({ err: error }, 'SnapTrade callback failed')
    return err(500, 'An internal error occurred')
  }
}
