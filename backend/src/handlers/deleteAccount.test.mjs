import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/auth.mjs', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('../lib/users.mjs', () => ({
  deleteUser: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('../lib/dynamo.mjs', () => ({
  getPlaidItemsByUser: vi.fn(),
  deletePlaidItem: vi.fn(),
}))

vi.mock('../lib/plaid.mjs', () => ({
  getPlaidClient: vi.fn(),
}))

vi.mock('../lib/snaptrade.mjs', () => ({
  getSnapTradeClient: vi.fn(),
}))

vi.mock('../lib/snapTradeDynamo.mjs', () => ({
  getSnapTradeUser: vi.fn(),
  getSnapTradeConnectionsByUser: vi.fn(),
  deleteSnapTradeConnection: vi.fn(),
  deleteSnapTradeUser: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ Contents: [], IsTruncated: false }),
  })),
  DeleteObjectCommand: vi.fn(),
  ListObjectsV2Command: vi.fn(),
}))

vi.mock('../lib/logger.mjs', () => ({
  createRequestLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  createAuditLogger: () => ({ info: vi.fn() }),
}))

const { requireAuth } = await import('../lib/auth.mjs')
const { deleteUser } = await import('../lib/users.mjs')
const { getPlaidItemsByUser, deletePlaidItem } = await import('../lib/dynamo.mjs')
const { getPlaidClient } = await import('../lib/plaid.mjs')
const { getSnapTradeClient } = await import('../lib/snaptrade.mjs')
const {
  getSnapTradeUser,
  getSnapTradeConnectionsByUser,
  deleteSnapTradeConnection,
  deleteSnapTradeUser,
} = await import('../lib/snapTradeDynamo.mjs')
const { handler } = await import('./deleteAccount.mjs')

const user = { sub: 'user-1', orgId: 'org-1' }

function makeEvent() {
  return { headers: {}, body: '{}' }
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockReturnValue({ user })
  getPlaidItemsByUser.mockResolvedValue([])
  getPlaidClient.mockReturnValue({ itemRemove: vi.fn() })
  deleteUser.mockResolvedValue()
})

describe('deleteAccount', () => {
  it('returns 401 when not authenticated', async () => {
    requireAuth.mockReturnValue({ error: { statusCode: 401, message: 'Unauthorized' } })
    const res = await handler(makeEvent())
    expect(res.statusCode).toBe(401)
  })

  it('calls getSnapTradeUser with orgId (not _SNAPTRADE_USER_ prefix)', async () => {
    getSnapTradeUser.mockResolvedValue(null)

    await handler(makeEvent())

    // The fix ensures deleteAccount queries with the same key format
    // that snapTradeConnect uses: { userId: orgId, itemId: 'st_user' }
    // NOT the old format: { userId: '_SNAPTRADE_USER_org-1', itemId: 'registration' }
    expect(getSnapTradeUser).toHaveBeenCalledWith('org-1')
  })

  it('deregisters SnapTrade user and cleans up connections when found', async () => {
    const mockStClient = {
      authentication: { deleteSnapTradeUser: vi.fn().mockResolvedValue({}) },
    }
    getSnapTradeClient.mockReturnValue(mockStClient)
    getSnapTradeUser.mockResolvedValue({
      userId: 'org-1',
      snapTradeUserId: 'org-1',
      userSecret: 'test-secret',
    })
    getSnapTradeConnectionsByUser.mockResolvedValue([
      { connectionId: 'conn-1' },
      { connectionId: 'conn-2' },
    ])
    deleteSnapTradeConnection.mockResolvedValue()
    deleteSnapTradeUser.mockResolvedValue()

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    expect(mockStClient.authentication.deleteSnapTradeUser).toHaveBeenCalledWith({
      userId: 'org-1',
    })
    expect(deleteSnapTradeConnection).toHaveBeenCalledTimes(2)
    expect(deleteSnapTradeConnection).toHaveBeenCalledWith('org-1', 'conn-1')
    expect(deleteSnapTradeConnection).toHaveBeenCalledWith('org-1', 'conn-2')
    expect(deleteSnapTradeUser).toHaveBeenCalledWith('org-1')
  })

  it('skips SnapTrade cleanup when no user registration found', async () => {
    getSnapTradeUser.mockResolvedValue(null)

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    expect(getSnapTradeConnectionsByUser).not.toHaveBeenCalled()
    expect(deleteSnapTradeUser).not.toHaveBeenCalled()
  })

  it('continues deletion even if SnapTrade API call fails', async () => {
    getSnapTradeClient.mockReturnValue({
      authentication: {
        deleteSnapTradeUser: vi.fn().mockRejectedValue(new Error('API error')),
      },
    })
    getSnapTradeUser.mockResolvedValue({
      userId: 'org-1',
      snapTradeUserId: 'org-1',
      userSecret: 'test-secret',
    })
    getSnapTradeConnectionsByUser.mockResolvedValue([])
    deleteSnapTradeUser.mockResolvedValue()

    const res = await handler(makeEvent())

    // Should succeed despite SnapTrade API error
    expect(res.statusCode).toBe(200)
    expect(deleteSnapTradeUser).toHaveBeenCalledWith('org-1')
  })

  it('uses orgId when available (not userId) for SnapTrade lookup', async () => {
    const userWithOrg = { sub: 'user-abc', orgId: 'org-xyz' }
    requireAuth.mockReturnValue({ user: userWithOrg })
    getSnapTradeUser.mockResolvedValue(null)

    await handler(makeEvent())

    // plaidUserId = orgId || userId, should use orgId
    expect(getSnapTradeUser).toHaveBeenCalledWith('org-xyz')
  })

  it('falls back to userId when orgId is not set', async () => {
    const userWithoutOrg = { sub: 'user-abc' }
    requireAuth.mockReturnValue({ user: userWithoutOrg })
    getSnapTradeUser.mockResolvedValue(null)

    await handler(makeEvent())

    // plaidUserId = orgId || userId, should fall back to userId
    expect(getSnapTradeUser).toHaveBeenCalledWith('user-abc')
  })
})
