import crypto from 'node:crypto'
import { getPlaidClient } from '../lib/plaid.mjs'
import { getPlaidItemByItemId } from '../lib/dynamo.mjs'
import { getOrgForUser } from '../lib/orgMembers.mjs'
import { signToken } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'
import { handler as syncHandler } from './sync.mjs'

// Cache verified webhook keys for 24h to avoid repeated Plaid API calls
const keyCache = new Map()
const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Webhook event types that should trigger a sync
const SYNC_TRIGGER_EVENTS = new Set([
  'SYNC_UPDATES_AVAILABLE',
  'DEFAULT_UPDATE',
  'INITIAL_UPDATE',
  'HISTORICAL_UPDATE',
  'TRANSACTIONS_REMOVED',
])

/**
 * POST /plaid/webhook
 *
 * Receives webhook events from Plaid and triggers appropriate actions.
 * This is a public endpoint — Plaid calls it directly, so no JWT auth
 * is required. Security is handled via Plaid's webhook signature verification.
 *
 * Plaid webhook types handled:
 *   - TRANSACTIONS: SYNC_UPDATES_AVAILABLE, DEFAULT_UPDATE, etc. → auto-sync
 */
export async function handler(event) {
  const log = createRequestLogger('plaidWebhook', event)

  try {
    const body = event.body || '{}'
    const payload = JSON.parse(body)

    const { webhook_type, webhook_code, item_id } = payload

    log.info({ webhook_type, webhook_code, item_id }, 'webhook received')

    // ── Verify webhook signature ──
    const verificationHeader = event.headers?.['Plaid-Verification']
      || event.headers?.['plaid-verification']

    if (!verificationHeader) {
      log.warn('webhook missing Plaid-Verification header')
      return err(401, 'Missing webhook signature')
    }

    const verified = await verifyWebhookSignature(verificationHeader, body, log)
    if (!verified) {
      log.warn({ item_id }, 'webhook signature verification failed')
      return err(401, 'Invalid webhook signature')
    }

    // ── Handle TRANSACTIONS webhooks ──
    if (webhook_type === 'TRANSACTIONS' && SYNC_TRIGGER_EVENTS.has(webhook_code)) {
      await handleTransactionWebhook(item_id, webhook_code, log)
    } else {
      log.info({ webhook_type, webhook_code }, 'unhandled webhook type — acknowledged')
    }

    // Always return 200 to Plaid so it doesn't retry
    return ok({ received: true })
  } catch (error) {
    log.error({ err: error }, 'webhook processing failed')
    // Return 200 even on error to prevent Plaid from retrying indefinitely.
    // Errors are logged for investigation via CloudWatch.
    return ok({ received: true, error: 'internal processing error' })
  }
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify the Plaid webhook JWT signature.
 *
 * Plaid signs webhooks with a rotating JWK (ES256). The process:
 * 1. Decode the JWT header to extract the key ID (kid)
 * 2. Fetch the public key from Plaid using webhookVerificationKeyGet
 * 3. Verify the JWT signature using the public key
 * 4. Verify the body hash matches the request body SHA-256
 */
async function verifyWebhookSignature(jwtToken, rawBody, log) {
  try {
    const parts = jwtToken.split('.')
    if (parts.length !== 3) return false

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    const kid = header.kid
    if (!kid) return false

    // Get the public key (from cache or Plaid API)
    const jwk = await getVerificationKey(kid, log)
    if (!jwk) return false

    // Convert JWK to a Node.js KeyObject for verification
    const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' })

    // Verify the JWT signature (ES256 = ECDSA with P-256 and SHA-256)
    const signatureInput = `${parts[0]}.${parts[1]}`
    const signature = Buffer.from(parts[2], 'base64url')

    const isValid = crypto.verify(
      'SHA256',
      Buffer.from(signatureInput),
      { key: keyObject, dsaEncoding: 'ieee-p1363' },
      signature,
    )

    if (!isValid) {
      log.warn({ kid }, 'JWT signature verification failed')
      return false
    }

    // Decode the JWT payload and verify the body hash
    const jwtPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    const expectedHash = jwtPayload.request_body_sha256

    if (expectedHash) {
      const actualHash = crypto.createHash('sha256').update(rawBody).digest('hex')
      if (actualHash !== expectedHash) {
        log.warn('webhook body hash mismatch')
        return false
      }
    }

    // Verify the JWT hasn't expired (5 min tolerance)
    if (jwtPayload.iat) {
      const age = Date.now() / 1000 - jwtPayload.iat
      if (age > 5 * 60) {
        log.warn({ iatAge: age }, 'webhook JWT too old')
        return false
      }
    }

    return true
  } catch (error) {
    log.error({ err: error }, 'webhook signature verification error')
    return false
  }
}

/**
 * Fetch a webhook verification key from Plaid, with caching.
 */
async function getVerificationKey(kid, log) {
  const cached = keyCache.get(kid)
  if (cached && Date.now() - cached.fetchedAt < KEY_CACHE_TTL_MS) {
    return cached.key
  }

  try {
    const client = getPlaidClient()
    const res = await client.webhookVerificationKeyGet({ key_id: kid })
    const jwk = res.data.key

    keyCache.set(kid, { key: jwk, fetchedAt: Date.now() })

    // Prune old keys (keep at most 10)
    if (keyCache.size > 10) {
      const oldest = [...keyCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0]
      keyCache.delete(oldest[0])
    }

    return jwk
  } catch (error) {
    log.error({ err: error, kid }, 'failed to fetch webhook verification key from Plaid')
    return null
  }
}

// ---------------------------------------------------------------------------
// Transaction webhook handler
// ---------------------------------------------------------------------------

/**
 * Handle a TRANSACTIONS webhook event by looking up the item owner
 * and triggering a sync for their account.
 */
async function handleTransactionWebhook(itemId, webhookCode, log) {
  if (!itemId) {
    log.warn('TRANSACTIONS webhook missing item_id')
    return
  }

  // Look up the Plaid item to find the owner
  const item = await getPlaidItemByItemId(itemId)
  if (!item) {
    log.warn({ itemId }, 'webhook item_id not found in database — may have been disconnected')
    return
  }

  const userId = item.userId

  // Look up the user's org membership for the sync context
  const membership = await getOrgForUser(userId)
  if (!membership) {
    log.warn({ userId, itemId }, 'webhook user has no org membership — cannot sync')
    return
  }

  log.info({ userId, orgId: membership.orgId, itemId, webhookCode }, 'triggering auto-sync from webhook')

  // Create an internal JWT to authenticate the sync call
  const token = signToken(userId, {
    orgId: membership.orgId,
    orgRole: membership.role,
  })

  // Construct a synthetic API Gateway event for the sync handler
  const syncEvent = {
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ itemId }),
    requestContext: { requestId: `webhook-${Date.now()}` },
  }

  const syncResult = await syncHandler(syncEvent)
  const statusCode = syncResult?.statusCode

  if (statusCode === 200) {
    log.info({ itemId, webhookCode }, 'webhook-triggered sync completed successfully')
  } else if (statusCode === 429) {
    // Cooldown or budget limit — not an error, will sync on next manual trigger
    log.info({ itemId, statusCode }, 'webhook sync skipped (cooldown or budget limit)')
  } else {
    log.warn({ itemId, statusCode, body: syncResult?.body }, 'webhook-triggered sync returned non-200')
  }
}
