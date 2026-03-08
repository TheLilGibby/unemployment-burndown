import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/plaid.mjs', () => ({
  getPlaidClient: vi.fn(),
}))

vi.mock('../lib/dynamo.mjs', () => ({
  getPlaidItemsByUser: vi.fn(),
  isValidAccessToken: vi.fn(),
}))

vi.mock('../lib/s3.mjs', () => ({
  readAccountsCache: vi.fn(),
  writeAccountsCache: vi.fn(),
}))

vi.mock('../lib/auth.mjs', () => ({
  requireOrg: vi.fn(),
}))

vi.mock('../lib/logger.mjs', () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

const { getPlaidClient } = await import('../lib/plaid.mjs')
const { getPlaidItemsByUser, isValidAccessToken } = await import('../lib/dynamo.mjs')
const { readAccountsCache, writeAccountsCache } = await import('../lib/s3.mjs')
const { requireOrg } = await import('../lib/auth.mjs')
const { handler } = await import('./accounts.mjs')

const user = { sub: 'user-1', orgId: 'org-1' }

function makeEvent(overrides = {}) {
  return {
    headers: {},
    queryStringParameters: {},
    ...overrides,
  }
}

function makePlaidItem(overrides = {}) {
  return {
    itemId: 'item-1',
    accessToken: 'access-sandbox-abc123',
    institutionName: 'Test Bank',
    institutionId: 'ins_1',
    connectedBy: 'user-1',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePlaidAccount(overrides = {}) {
  return {
    account_id: 'acct-1',
    name: 'Checking',
    official_name: 'Primary Checking',
    type: 'depository',
    subtype: 'checking',
    mask: '1234',
    balances: { current: 1000, available: 950, limit: null },
    ...overrides,
  }
}

describe('accounts handler', () => {
  let mockClient

  beforeEach(() => {
    vi.clearAllMocks()
    requireOrg.mockReturnValue({ user })
    isValidAccessToken.mockReturnValue(true)
    mockClient = { accountsGet: vi.fn() }
    getPlaidClient.mockReturnValue(mockClient)
  })

  it('serves from cache when available', async () => {
    const cached = { items: [{ itemId: 'item-1', accounts: [] }], cachedAt: '2026-01-01' }
    readAccountsCache.mockResolvedValue(cached)

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.fromCache).toBe(true)
    expect(body.items).toEqual(cached.items)
    expect(getPlaidClient).not.toHaveBeenCalled()
  })

  it('bypasses cache when force=true', async () => {
    readAccountsCache.mockResolvedValue({ items: [{ itemId: 'old' }] })
    getPlaidItemsByUser.mockResolvedValue([makePlaidItem()])
    mockClient.accountsGet.mockResolvedValue({
      data: { accounts: [makePlaidAccount()] },
    })

    const res = await handler(makeEvent({ queryStringParameters: { force: 'true' } }))

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.fromCache).toBe(false)
    expect(writeAccountsCache).toHaveBeenCalled()
  })

  it('caches result when all items succeed', async () => {
    readAccountsCache.mockResolvedValue(null)
    getPlaidItemsByUser.mockResolvedValue([makePlaidItem()])
    mockClient.accountsGet.mockResolvedValue({
      data: { accounts: [makePlaidAccount()] },
    })

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    expect(writeAccountsCache).toHaveBeenCalledTimes(1)
    const cachedItems = writeAccountsCache.mock.calls[0][1]
    expect(cachedItems).toHaveLength(1)
    expect(cachedItems[0].error).toBeUndefined()
  })

  it('does NOT cache when an item has a Plaid error', async () => {
    readAccountsCache.mockResolvedValue(null)
    const item1 = makePlaidItem({ itemId: 'item-1' })
    const item2 = makePlaidItem({ itemId: 'item-2', accessToken: 'access-sandbox-def456' })
    getPlaidItemsByUser.mockResolvedValue([item1, item2])

    mockClient.accountsGet
      .mockResolvedValueOnce({ data: { accounts: [makePlaidAccount()] } })
      .mockRejectedValueOnce(new Error('ITEM_LOGIN_REQUIRED'))

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.items).toHaveLength(2)
    expect(body.items[1].error).toBeDefined()
    expect(writeAccountsCache).not.toHaveBeenCalled()
  })

  it('does NOT cache when an item has an invalid access token', async () => {
    readAccountsCache.mockResolvedValue(null)
    const item = makePlaidItem()
    getPlaidItemsByUser.mockResolvedValue([item])
    isValidAccessToken.mockReturnValue(false)

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.items[0].error).toBeDefined()
    expect(writeAccountsCache).not.toHaveBeenCalled()
  })

  it('does not leak raw Plaid error messages to the client', async () => {
    readAccountsCache.mockResolvedValue(null)
    getPlaidItemsByUser.mockResolvedValue([makePlaidItem()])

    const plaidErr = new Error('the access_token for item_id=item_abc is in a bad state')
    plaidErr.response = { data: { error_message: 'ITEM_LOGIN_REQUIRED: user must re-authenticate' } }
    mockClient.accountsGet.mockRejectedValue(plaidErr)

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    const errorItem = body.items[0]
    expect(errorItem.error).not.toContain('access_token')
    expect(errorItem.error).not.toContain('ITEM_LOGIN_REQUIRED')
    expect(errorItem.error).toContain('disconnecting and reconnecting')
  })

  it('returns generic message on 500 errors', async () => {
    readAccountsCache.mockResolvedValue(null)
    getPlaidItemsByUser.mockRejectedValue(new Error('DynamoDB table arn:aws:dynamodb:...'))

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(500)
    const body = JSON.parse(res.body)
    expect(body.error).not.toContain('DynamoDB')
    expect(body.error).toBe('An internal error occurred')
  })

  it('returns empty items when no Plaid items exist', async () => {
    readAccountsCache.mockResolvedValue(null)
    getPlaidItemsByUser.mockResolvedValue([])

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.items).toEqual([])
  })
})
