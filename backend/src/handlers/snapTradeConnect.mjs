import { getSnapTradeClient } from '../lib/snaptrade.mjs'
import { getSnapTradeUser, putSnapTradeUser } from '../lib/snapTradeDynamo.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /snaptrade/connect
 *
 * Registers a SnapTrade user for the org (lazy, first-time only) and
 * returns a Connection Portal URL for the frontend to open in a popup.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const orgId = user.orgId
    const client = getSnapTradeClient()

    // Lazy-register SnapTrade user if first time
    let stUser = await getSnapTradeUser(orgId)
    if (!stUser) {
      const regRes = await client.authentication.registerSnapTradeUser({
        userId: orgId,
      })

      await putSnapTradeUser({
        userId: orgId,
        snapTradeUserId: regRes.data.userId || orgId,
        userSecret: regRes.data.userSecret,
      })

      stUser = await getSnapTradeUser(orgId)
    }

    // Generate Connection Portal URL
    const loginRes = await client.authentication.loginSnapTradeUser({
      userId: stUser.snapTradeUserId,
      userSecret: stUser.userSecret,
    })

    return ok({ portalUrl: loginRes.data.redirectURI || loginRes.data.loginRedirectURI })
  } catch (error) {
    const log = createRequestLogger('snapTradeConnect', event)
    log.error({ err: error }, 'SnapTrade connect failed')
    return err(500, 'An internal error occurred')
  }
}
