import { getSnapTradeClient, isSnapTradeConfigured } from '../lib/snaptrade.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'
import { getPlaidItem } from '../lib/dynamo.mjs'
import { decrypt, isEncryptionConfigured } from '../lib/encryption.mjs'

/**
 * DELETE /api/snaptrade/connections/:connectionId
 *
 * Disconnects a brokerage from SnapTrade and removes the authorization.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (!isSnapTradeConfigured()) {
      return err(503, 'SnapTrade integration is not configured')
    }

    const connectionId = event.pathParameters?.connectionId
    if (!connectionId) {
      return err(400, 'connectionId is required')
    }

    const orgId = user.orgId

    // Retrieve stored userSecret
    const reg = await getPlaidItem(`_SNAPTRADE_USER_${orgId}`, 'registration')
    if (!reg?.accessToken) {
      return err(400, 'Organization not registered with SnapTrade')
    }
    const userSecret = isEncryptionConfigured() ? decrypt(reg.accessToken) : reg.accessToken

    const client = getSnapTradeClient()
    await client.deleteConnection(orgId, userSecret, connectionId)

    return ok({ disconnected: true, connectionId })
  } catch (error) {
    const log = createRequestLogger('snaptradeDisconnect', event)
    log.error({ err: error }, 'SnapTrade disconnect failed')
    return err(500, error.message)
  }
}
