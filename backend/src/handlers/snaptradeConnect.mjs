import { getSnapTradeClient, isSnapTradeConfigured } from '../lib/snaptrade.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'
import { getPlaidItem, putPlaidItem } from '../lib/dynamo.mjs'
import { encrypt, decrypt, isEncryptionConfigured } from '../lib/encryption.mjs'

/**
 * POST /api/snaptrade/connect
 *
 * Generates a redirect URL for the user to connect a brokerage account
 * (e.g., Fidelity) via SnapTrade. Registers the org as a SnapTrade user
 * if not already registered.
 *
 * Body: { broker?: string, callbackUrl?: string }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (!isSnapTradeConfigured()) {
      return err(503, 'SnapTrade integration is not configured')
    }

    const body = JSON.parse(event.body || '{}')
    const { broker, callbackUrl } = body
    const orgId = user.orgId
    const client = getSnapTradeClient()

    // Check if org already registered — stored in DynamoDB with special key
    let userSecret
    const existing = await getPlaidItem(`_SNAPTRADE_USER_${orgId}`, 'registration')
    if (existing?.accessToken) {
      userSecret = isEncryptionConfigured() ? decrypt(existing.accessToken) : existing.accessToken
    } else {
      // Register new SnapTrade user for this org
      const registration = await client.registerUser(orgId)
      userSecret = registration.userSecret
      // Store encrypted userSecret in DynamoDB (reuse PlaidTokens table)
      await putPlaidItem({
        userId: `_SNAPTRADE_USER_${orgId}`,
        itemId: 'registration',
        accessToken: isEncryptionConfigured() ? encrypt(userSecret) : userSecret,
        institutionId: null,
        institutionName: 'SnapTrade',
        connectedBy: user.sub,
      })
    }

    // Generate login link for brokerage connection
    const loginData = await client.getLoginLink(orgId, userSecret, {
      broker: broker || undefined,
      callbackUrl: callbackUrl || undefined,
    })

    return ok({
      redirectUrl: loginData.redirectURI || loginData.loginLink || loginData.url,
      broker: broker || null,
    })
  } catch (error) {
    const log = createRequestLogger('snaptradeConnect', event)
    log.error({ err: error }, 'SnapTrade connect failed')
    return err(500, error.message)
  }
}
