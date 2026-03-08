import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(() => 'hashed') } }))
vi.mock('../lib/users.mjs', () => ({
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
}))
vi.mock('../lib/auth.mjs', () => ({
  signToken: vi.fn(() => 'jwt-token'),
}))
vi.mock('../lib/invites.mjs', () => ({
  getInviteByToken: vi.fn(),
}))
vi.mock('../lib/logger.mjs', () => ({
  createRequestLogger: vi.fn(() => ({ error: vi.fn(), info: vi.fn() })),
  createAuditLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn() })),
}))
vi.mock('../lib/rateLimit.mjs', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '1.2.3.4'),
}))

process.env.ALLOWED_ORIGIN = 'https://test.app'

const { handler } = await import('./register.mjs')
const { getUserByEmail } = await import('../lib/users.mjs')
const { checkRateLimit } = await import('../lib/rateLimit.mjs')

function makeEvent(body = {}) {
  return {
    body: JSON.stringify(body),
    requestContext: { identity: { sourceIp: '1.2.3.4' } },
  }
}

describe('register handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimit.mockResolvedValue({ allowed: true, current: 1 })
    getUserByEmail.mockResolvedValue(null)
  })

  it('returns 429 when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, retryAfter: 30, current: 6 })

    const res = await handler(makeEvent({ email: 'test@example.com', password: 'password123' }))

    expect(res.statusCode).toBe(429)
    expect(res.headers['Retry-After']).toBe('30')
    expect(JSON.parse(res.body).error).toContain('Too many requests')
  })

  it('calls rate limiter with correct params', async () => {
    await handler(makeEvent({ email: 'test@example.com', password: 'password123' }))

    expect(checkRateLimit).toHaveBeenCalledWith({
      scope: 'register',
      key: '1.2.3.4',
      maxRequests: 5,
      windowMs: 60_000,
      event: expect.any(Object),
    })
  })

  it('returns 200 when under rate limit', async () => {
    const res = await handler(makeEvent({ email: 'test@example.com', password: 'password123' }))

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.token).toBe('jwt-token')
  })

  it('returns 400 for missing fields even when rate limit allows', async () => {
    const res = await handler(makeEvent({ email: '' }))

    expect(res.statusCode).toBe(400)
  })
})
