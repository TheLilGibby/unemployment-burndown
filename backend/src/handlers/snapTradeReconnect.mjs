import { getSnapTradeClient } from '../lib/snaptrade.mjs'
import { getSnapTradeUser } from '../lib/snapTradeDynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /snaptrade/reconnect
 *
 * Generates a new SnapTrade Connection Portal URL for an existing connection,
 * allowing the user to re-authenticate without losing their connection data.
 *
 * Body: { connectionId: string }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { connectionId } = body

    if (!connectionId) {
      return err(400, 'connectionId is required')
    }

    const orgId = user.orgId
    const client = getSnapTradeClient()

    const stUser = await getSnapTradeUser(orgId)
    if (!stUser) {
      return err(400, 'SnapTrade user not registered — connect a brokerage first')
    }

    // Generate a new portal URL scoped to re-authorize the existing connection
    const loginRes = await client.authentication.loginSnapTradeUser({
      userId: stUser.snapTradeUserId,
      userSecret: stUser.userSecret,
      connectionId,
    })

    const portalUrl = loginRes.data.redirectURI || loginRes.data.loginRedirectURI
    if (!portalUrl) {
      return err(500, 'No portal URL returned from SnapTrade')
    }

    return ok({ portalUrl })
  } catch (error) {
    const log = createRequestLogger('snapTradeReconnect', event)
    log.error({ err: error }, 'SnapTrade reconnect failed')
    return err(500, 'Failed to generate reconnection URL')
  }
}
