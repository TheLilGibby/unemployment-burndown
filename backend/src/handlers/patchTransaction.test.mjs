import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/s3.mjs', () => ({
  readStatementWithETag: vi.fn(),
  writeStatementIfMatch: vi.fn(),
}))

vi.mock('../lib/auth.mjs', () => ({
  requireOrg: vi.fn(),
}))

vi.mock('../lib/logger.mjs', () => ({
  createRequestLogger: () => ({ error: vi.fn() }),
}))

const { readStatementWithETag, writeStatementIfMatch } = await import('../lib/s3.mjs')
const { requireOrg } = await import('../lib/auth.mjs')
const { handler } = await import('./patchTransaction.mjs')

const user = { sub: 'user-1', orgId: 'org-1' }

function makeEvent(overrides = {}) {
  return {
    pathParameters: { statementId: 'stmt-1', transactionId: 'txn-1' },
    body: JSON.stringify({ category: 'Food' }),
    headers: {},
    ...overrides,
  }
}

function makeStatement(txns = [{ id: 'txn-1', amount: 100, category: 'Other' }]) {
  return { id: 'stmt-1', transactions: txns }
}

beforeEach(() => {
  vi.clearAllMocks()
  requireOrg.mockReturnValue({ user })
})

describe('patchTransaction', () => {
  it('returns 400 when statementId or transactionId missing', async () => {
    const res = await handler(makeEvent({ pathParameters: {} }))
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when no valid fields provided', async () => {
    const res = await handler(makeEvent({ body: JSON.stringify({ bogus: true }) }))
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when statement not found', async () => {
    readStatementWithETag.mockResolvedValue({ data: null, etag: null })
    const res = await handler(makeEvent())
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 when transaction not found in statement', async () => {
    readStatementWithETag.mockResolvedValue({
      data: makeStatement([{ id: 'other-txn', amount: 50 }]),
      etag: '"etag-1"',
    })
    const res = await handler(makeEvent())
    expect(res.statusCode).toBe(404)
  })

  it('updates transaction and writes with ETag', async () => {
    readStatementWithETag.mockResolvedValue({
      data: makeStatement(),
      etag: '"etag-1"',
    })
    writeStatementIfMatch.mockResolvedValue()

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.updated).toBe(true)
    expect(body.transaction.category).toBe('Food')
    expect(body.transaction.userModified).toBe(true)
    expect(body.transaction.userModifiedBy).toBe('user-1')
    expect(body.transaction.userModifiedFields).toEqual(['category'])

    expect(writeStatementIfMatch).toHaveBeenCalledWith(
      'org-1', 'stmt-1',
      expect.objectContaining({ id: 'stmt-1' }),
      '"etag-1"',
    )
  })

  it('retries on ETag conflict (412) and succeeds', async () => {
    const preconditionErr = new Error('PreconditionFailed')
    preconditionErr.name = 'PreconditionFailed'
    preconditionErr.$metadata = { httpStatusCode: 412 }

    readStatementWithETag
      .mockResolvedValueOnce({ data: makeStatement(), etag: '"etag-1"' })
      .mockResolvedValueOnce({ data: makeStatement(), etag: '"etag-2"' })

    writeStatementIfMatch
      .mockRejectedValueOnce(preconditionErr)
      .mockResolvedValueOnce()

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(200)
    expect(readStatementWithETag).toHaveBeenCalledTimes(2)
    expect(writeStatementIfMatch).toHaveBeenCalledTimes(2)
    expect(writeStatementIfMatch.mock.calls[1][3]).toBe('"etag-2"')
  })

  it('gives up after MAX_RETRIES and returns 500', async () => {
    const preconditionErr = new Error('PreconditionFailed')
    preconditionErr.name = 'PreconditionFailed'
    preconditionErr.$metadata = { httpStatusCode: 412 }

    readStatementWithETag.mockResolvedValue({ data: makeStatement(), etag: '"stale"' })
    writeStatementIfMatch.mockRejectedValue(preconditionErr)

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(500)
    // 1 initial + 3 retries = 4 attempts
    expect(writeStatementIfMatch).toHaveBeenCalledTimes(4)
  })

  it('throws non-412 errors immediately without retry', async () => {
    readStatementWithETag.mockResolvedValue({ data: makeStatement(), etag: '"etag-1"' })
    writeStatementIfMatch.mockRejectedValue(new Error('AccessDenied'))

    const res = await handler(makeEvent())

    expect(res.statusCode).toBe(500)
    expect(writeStatementIfMatch).toHaveBeenCalledTimes(1)
  })

  it('accumulates userModifiedFields across patches', async () => {
    const stmt = makeStatement([{
      id: 'txn-1',
      amount: 100,
      category: 'Other',
      userModifiedFields: ['isPayroll'],
    }])
    readStatementWithETag.mockResolvedValue({ data: stmt, etag: '"etag-1"' })
    writeStatementIfMatch.mockResolvedValue()

    const res = await handler(makeEvent())

    const body = JSON.parse(res.body)
    expect(body.transaction.userModifiedFields).toEqual(
      expect.arrayContaining(['isPayroll', 'category'])
    )
  })

  it('returns auth error when requireOrg fails', async () => {
    requireOrg.mockReturnValue({ error: { statusCode: 401, message: 'Unauthorized' } })
    const res = await handler(makeEvent())
    expect(res.statusCode).toBe(401)
  })
})
