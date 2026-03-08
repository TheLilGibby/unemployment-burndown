import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DynamoDB before importing the module
const mockSend = vi.fn()
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {},
}))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  UpdateCommand: class MockUpdateCommand {
    constructor(params) { Object.assign(this, params) }
  },
}))
vi.mock('./logger.mjs', () => ({
  createAuditLogger: vi.fn(() => ({
    warn: vi.fn(),
    info: vi.fn(),
  })),
}))

process.env.RATE_LIMIT_TABLE = 'TestRateLimits'

const { checkRateLimit, getClientIp } = await import('./rateLimit.mjs')

describe('getClientIp', () => {
  it('extracts IP from requestContext.identity.sourceIp', () => {
    const event = { requestContext: { identity: { sourceIp: '1.2.3.4' } } }
    expect(getClientIp(event)).toBe('1.2.3.4')
  })

  it('falls back to X-Forwarded-For header', () => {
    const event = { headers: { 'X-Forwarded-For': '5.6.7.8, 10.0.0.1' } }
    expect(getClientIp(event)).toBe('5.6.7.8')
  })

  it('falls back to lowercase x-forwarded-for', () => {
    const event = { headers: { 'x-forwarded-for': '9.8.7.6' } }
    expect(getClientIp(event)).toBe('9.8.7.6')
  })

  it('returns unknown for missing event', () => {
    expect(getClientIp(null)).toBe('unknown')
    expect(getClientIp({})).toBe('unknown')
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows request when under limit', async () => {
    mockSend.mockResolvedValue({ Attributes: { requestCount: 1 } })

    const result = await checkRateLimit({
      scope: 'test',
      key: '1.2.3.4',
      maxRequests: 5,
      windowMs: 60_000,
    })

    expect(result.allowed).toBe(true)
    expect(result.current).toBe(1)
    expect(result.retryAfter).toBeUndefined()
  })

  it('allows request at exactly the limit', async () => {
    mockSend.mockResolvedValue({ Attributes: { requestCount: 5 } })

    const result = await checkRateLimit({
      scope: 'test',
      key: '1.2.3.4',
      maxRequests: 5,
      windowMs: 60_000,
    })

    expect(result.allowed).toBe(true)
    expect(result.current).toBe(5)
  })

  it('denies request when over limit', async () => {
    mockSend.mockResolvedValue({ Attributes: { requestCount: 6 } })

    const result = await checkRateLimit({
      scope: 'test',
      key: '1.2.3.4',
      maxRequests: 5,
      windowMs: 60_000,
    })

    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(result.retryAfter).toBeLessThanOrEqual(60)
    expect(result.current).toBe(6)
  })

  it('sends correct DynamoDB UpdateCommand', async () => {
    mockSend.mockResolvedValue({ Attributes: { requestCount: 1 } })

    await checkRateLimit({
      scope: 'register',
      key: '10.0.0.1',
      maxRequests: 5,
      windowMs: 60_000,
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
    const command = mockSend.mock.calls[0][0]
    expect(command.TableName).toBe('TestRateLimits')
    expect(command.Key.pk).toMatch(/^register#10\.0\.0\.1#\d+$/)
    expect(command.UpdateExpression).toContain('ADD requestCount')
    expect(command.ReturnValues).toBe('ALL_NEW')
  })

  it('logs rate limit exceeded when event is provided', async () => {
    const { createAuditLogger } = await import('./logger.mjs')
    const mockWarn = vi.fn()
    createAuditLogger.mockReturnValue({ warn: mockWarn, info: vi.fn() })

    mockSend.mockResolvedValue({ Attributes: { requestCount: 6 } })

    const event = { requestContext: { requestId: 'req-123' } }
    await checkRateLimit({
      scope: 'test',
      key: '1.2.3.4',
      maxRequests: 5,
      windowMs: 60_000,
      event,
    })

    expect(createAuditLogger).toHaveBeenCalledWith('rate-limit', event)
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'test', key: '1.2.3.4', current: 6, maxRequests: 5 }),
      'rate limit exceeded',
    )
  })

  it('uses different window IDs for different time windows', async () => {
    mockSend.mockResolvedValue({ Attributes: { requestCount: 1 } })

    // Call with 1-hour window
    await checkRateLimit({ scope: 'test', key: '1.2.3.4', maxRequests: 5, windowMs: 3_600_000 })
    const hourlyPk = mockSend.mock.calls[0][0].Key.pk

    // Call with 1-minute window
    await checkRateLimit({ scope: 'test', key: '1.2.3.4', maxRequests: 5, windowMs: 60_000 })
    const minutePk = mockSend.mock.calls[1][0].Key.pk

    // Different window sizes should produce different PKs
    expect(hourlyPk).not.toBe(minutePk)
  })
})
