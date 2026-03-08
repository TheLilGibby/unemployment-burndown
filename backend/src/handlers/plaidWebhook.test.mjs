import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

// ── Mock all external dependencies ──

vi.mock('../lib/plaid.mjs', () => ({
  getPlaidClient: vi.fn(),
}))

vi.mock('../lib/dynamo.mjs', () => ({
  getPlaidItemByItemId: vi.fn(),
}))

vi.mock('../lib/orgMembers.mjs', () => ({
  getOrgForUser: vi.fn(),
}))

vi.mock('../lib/auth.mjs', () => ({
  signToken: vi.fn(),
}))

vi.mock('../lib/response.mjs', () => ({
  ok: (body) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  err: (statusCode, message) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: message }),
  }),
}))

vi.mock('../lib/logger.mjs', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('./sync.mjs', () => ({
  handler: vi.fn(),
}))

const { getPlaidClient } = await import('../lib/plaid.mjs')
const { getPlaidItemByItemId } = await import('../lib/dynamo.mjs')
const { getOrgForUser } = await import('../lib/orgMembers.mjs')
const { signToken } = await import('../lib/auth.mjs')
const { handler: syncHandler } = await import('./sync.mjs')
const { handler } = await import('./plaidWebhook.mjs')

// ── Helpers ──

// Generate an EC key pair for webhook signature testing
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
})

const testKid = 'test-key-id-001'

function signWebhookJwt(body, { expired = false } = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: testKid, typ: 'JWT' })).toString('base64url')
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex')
  const iat = expired ? Math.floor(Date.now() / 1000) - 600 : Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iat,
    request_body_sha256: bodyHash,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const signature = crypto.sign('SHA256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' })

  return `${signingInput}.${signature.toString('base64url')}`
}

function makeWebhookBody(overrides = {}) {
  return JSON.stringify({
    webhook_type: 'TRANSACTIONS',
    webhook_code: 'SYNC_UPDATES_AVAILABLE',
    item_id: 'item-abc-123',
    ...overrides,
  })
}

function makeEvent(body, headerOverrides = {}) {
  const b = body || makeWebhookBody()
  return {
    body: b,
    headers: {
      'Plaid-Verification': signWebhookJwt(b),
      ...headerOverrides,
    },
  }
}

const mockPlaidClient = {
  webhookVerificationKeyGet: vi.fn(),
}

const testItem = {
  userId: 'user-1',
  itemId: 'item-abc-123',
  accessToken: 'access-sandbox-abc123',
  institutionName: 'Test Bank',
}

beforeEach(() => {
  vi.clearAllMocks()

  getPlaidClient.mockReturnValue(mockPlaidClient)

  // Return the test JWK for signature verification
  mockPlaidClient.webhookVerificationKeyGet.mockResolvedValue({
    data: {
      key: publicKey.export({ type: 'spki', format: 'jwk' }),
    },
  })

  // Default: item exists
  getPlaidItemByItemId.mockResolvedValue(testItem)

  // Default: user has an org
  getOrgForUser.mockResolvedValue({ orgId: 'org-1', userId: 'user-1', role: 'admin' })

  // Default: signToken returns a mock JWT
  signToken.mockReturnValue('mock-internal-jwt')

  // Default: sync handler succeeds
  syncHandler.mockResolvedValue({
    statusCode: 200,
    body: JSON.stringify({ updated: true }),
  })
})

// ── Tests ──

describe('plaidWebhook handler', () => {
  describe('signature verification', () => {
    it('returns 401 when Plaid-Verification header is missing', async () => {
      const res = await handler({ body: makeWebhookBody(), headers: {} })
      expect(res.statusCode).toBe(401)
      expect(JSON.parse(res.body).error).toMatch(/Missing webhook signature/)
    })

    it('returns 401 when JWT signature is invalid', async () => {
      const body = makeWebhookBody()
      const badToken = 'eyJhbGciOiJFUzI1NiJ9.eyJib2R5IjoiYmFkIn0.invalidsig'
      const res = await handler({
        body,
        headers: { 'Plaid-Verification': badToken },
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 when body hash does not match', async () => {
      const body = makeWebhookBody()
      const jwt = signWebhookJwt(body)
      const res = await handler({
        body: makeWebhookBody({ item_id: 'different-item' }),
        headers: { 'Plaid-Verification': jwt },
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 when JWT is too old', async () => {
      const body = makeWebhookBody()
      const jwt = signWebhookJwt(body, { expired: true })
      const res = await handler({
        body,
        headers: { 'Plaid-Verification': jwt },
      })
      expect(res.statusCode).toBe(401)
    })

    it('accepts valid webhook signatures', async () => {
      const res = await handler(makeEvent())
      expect(res.statusCode).toBe(200)
    })
  })

  describe('event routing', () => {
    it('acknowledges non-TRANSACTIONS webhook types without syncing', async () => {
      const body = makeWebhookBody({ webhook_type: 'ITEM', webhook_code: 'ERROR' })
      const res = await handler(makeEvent(body))
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).received).toBe(true)
      expect(syncHandler).not.toHaveBeenCalled()
    })

    it('acknowledges unhandled TRANSACTIONS codes without syncing', async () => {
      const body = makeWebhookBody({ webhook_code: 'SOME_FUTURE_CODE' })
      const res = await handler(makeEvent(body))
      expect(res.statusCode).toBe(200)
      expect(syncHandler).not.toHaveBeenCalled()
    })

    it('triggers sync for SYNC_UPDATES_AVAILABLE', async () => {
      const res = await handler(makeEvent())
      expect(res.statusCode).toBe(200)
      expect(getPlaidItemByItemId).toHaveBeenCalledWith('item-abc-123')
      expect(syncHandler).toHaveBeenCalled()
    })

    it('triggers sync for INITIAL_UPDATE', async () => {
      const body = makeWebhookBody({ webhook_code: 'INITIAL_UPDATE' })
      const res = await handler(makeEvent(body))
      expect(res.statusCode).toBe(200)
      expect(syncHandler).toHaveBeenCalled()
    })

    it('triggers sync for HISTORICAL_UPDATE', async () => {
      const body = makeWebhookBody({ webhook_code: 'HISTORICAL_UPDATE' })
      const res = await handler(makeEvent(body))
      expect(res.statusCode).toBe(200)
      expect(syncHandler).toHaveBeenCalled()
    })

    it('triggers sync for DEFAULT_UPDATE', async () => {
      const body = makeWebhookBody({ webhook_code: 'DEFAULT_UPDATE' })
      const res = await handler(makeEvent(body))
      expect(res.statusCode).toBe(200)
      expect(syncHandler).toHaveBeenCalled()
    })

    it('triggers sync for TRANSACTIONS_REMOVED', async () => {
      const body = makeWebhookBody({ webhook_code: 'TRANSACTIONS_REMOVED' })
      const res = await handler(makeEvent(body))
      expect(res.statusCode).toBe(200)
      expect(syncHandler).toHaveBeenCalled()
    })
  })

  describe('item lookup and sync delegation', () => {
    it('skips sync when item_id not found', async () => {
      getPlaidItemByItemId.mockResolvedValue(null)
      const res = await handler(makeEvent())
      expect(res.statusCode).toBe(200)
      expect(syncHandler).not.toHaveBeenCalled()
    })

    it('skips sync when user has no org', async () => {
      getOrgForUser.mockResolvedValue(null)
      const res = await handler(makeEvent())
      expect(res.statusCode).toBe(200)
      expect(syncHandler).not.toHaveBeenCalled()
    })

    it('creates internal JWT and calls sync handler with correct event', async () => {
      await handler(makeEvent())

      expect(signToken).toHaveBeenCalledWith('user-1', {
        orgId: 'org-1',
        orgRole: 'admin',
      })

      expect(syncHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-internal-jwt' },
          body: JSON.stringify({ itemId: 'item-abc-123' }),
        }),
      )
    })

    it('handles sync handler returning 429 gracefully', async () => {
      syncHandler.mockResolvedValue({
        statusCode: 429,
        body: JSON.stringify({ error: 'Cooldown active' }),
      })

      const res = await handler(makeEvent())
      expect(res.statusCode).toBe(200)
    })

    it('handles sync handler returning 500 gracefully', async () => {
      syncHandler.mockResolvedValue({
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal error' }),
      })

      const res = await handler(makeEvent())
      expect(res.statusCode).toBe(200)
    })
  })

  describe('error handling', () => {
    it('returns 200 even when sync handler throws', async () => {
      syncHandler.mockRejectedValue(new Error('Unexpected error'))

      const res = await handler(makeEvent())
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).received).toBe(true)
    })

    it('returns 200 when item lookup throws', async () => {
      getPlaidItemByItemId.mockRejectedValue(new Error('DynamoDB error'))

      const res = await handler(makeEvent())
      expect(res.statusCode).toBe(200)
    })

    it('handles missing item_id in webhook body', async () => {
      const parsed = { webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE' }
      const body = JSON.stringify(parsed)
      const res = await handler(makeEvent(body))
      expect(res.statusCode).toBe(200)
      expect(syncHandler).not.toHaveBeenCalled()
    })
  })

  describe('verification key caching', () => {
    it('does not re-fetch a cached key on subsequent calls', async () => {
      mockPlaidClient.webhookVerificationKeyGet.mockClear()

      await handler(makeEvent())
      const callsAfterFirst = mockPlaidClient.webhookVerificationKeyGet.mock.calls.length

      await handler(makeEvent())
      const callsAfterSecond = mockPlaidClient.webhookVerificationKeyGet.mock.calls.length

      // The second call should NOT have triggered an additional fetch
      expect(callsAfterSecond).toBe(callsAfterFirst)
    })
  })
})
