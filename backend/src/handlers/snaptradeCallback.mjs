import { getSnapTradeClient, isSnapTradeConfigured } from '../lib/snaptrade.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'
import { getPlaidItem } from '../lib/dynamo.mjs'
import { decrypt, isEncryptionConfigured } from '../lib/encryption.mjs'

/**
 * POST /api/snaptrade/callback
 *
 * Handles the callback after a user connects a brokerage via SnapTrade redirect.
 * Fetches the new connection details and caches account data in S3.
 *
 * Body: { authorizationId: string }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (!isSnapTradeConfigured()) {
      return err(503, 'SnapTrade integration is not configured')
    }

    const body = JSON.parse(event.body || '{}')
    const { authorizationId } = body
    const orgId = user.orgId

    if (!authorizationId) {
      return err(400, 'authorizationId is required')
    }

    // Retrieve stored userSecret
    const reg = await getPlaidItem(`_SNAPTRADE_USER_${orgId}`, 'registration')
    if (!reg?.accessToken) {
      return err(400, 'Organization not registered with SnapTrade. Connect a brokerage first.')
    }
    const userSecret = isEncryptionConfigured() ? decrypt(reg.accessToken) : reg.accessToken

    const client = getSnapTradeClient()

    // Fetch the new connection details
    const connections = await client.listConnections(orgId, userSecret)
    const newConnection = Array.isArray(connections)
      ? connections.find(c => c.id === authorizationId || c.authorizationId === authorizationId)
      : null

    // Fetch accounts for this connection
    const accounts = await client.listAccounts(orgId, userSecret)

    return ok({
      authorizationId,
      connection: newConnection || null,
      accounts: accounts || [],
      connectedBy: user.sub,
    })
  } catch (error) {
    const log = createRequestLogger('snaptradeCallback', event)
    log.error({ err: error }, 'SnapTrade callback failed')
    return err(500, error.message)
  }
}
