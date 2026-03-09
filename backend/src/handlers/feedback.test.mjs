import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.ALLOWED_ORIGIN = 'https://test.app'
process.env.JWT_SECRET = 'test-secret-for-unit-tests-only'
process.env.GITHUB_TOKEN = 'ghp_test_token_for_unit_tests'

vi.mock('../lib/auth.mjs', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('../lib/logger.mjs', () => ({
  createRequestLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}))

// Stub global fetch for GitHub API calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { requireAuth } = await import('../lib/auth.mjs')
const { handler } = await import('./feedback.mjs')

const user = { sub: 'user-1' }

function makeEvent(body = {}) {
  return {
    headers: { Authorization: 'Bearer valid-token' },
    body: JSON.stringify(body),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockReturnValue({ user })
  // Default: GitHub issue creation succeeds
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ number: 42, html_url: 'https://github.com/test/issues/42' }),
  })
})

describe('feedback handler', () => {
  it('returns 401 when not authenticated', async () => {
    requireAuth.mockReturnValue({ error: { statusCode: 401, message: 'Authentication required' } })
    const res = await handler(makeEvent({ description: 'test' }))
    expect(res.statusCode).toBe(401)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns 400 when description is missing', async () => {
    const res = await handler(makeEvent({}))
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when description is empty', async () => {
    const res = await handler(makeEvent({ description: '   ' }))
    expect(res.statusCode).toBe(400)
  })

  it('returns 413 when screenshot exceeds 5 MB', async () => {
    const largeScreenshot = 'data:image/png;base64,' + 'A'.repeat(6 * 1024 * 1024)
    const res = await handler(makeEvent({ description: 'bug', screenshot: largeScreenshot }))
    expect(res.statusCode).toBe(413)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('creates a GitHub issue for valid feedback', async () => {
    const res = await handler(makeEvent({ description: 'Something broke', category: 'bug' }))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.created).toBe(true)
    expect(body.issueNumber).toBe(42)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not call GitHub API when auth fails', async () => {
    requireAuth.mockReturnValue({ error: { statusCode: 401, message: 'Invalid or expired token' } })
    const res = await handler(makeEvent({ description: 'test', screenshot: 'data:image/png;base64,abc' }))
    expect(res.statusCode).toBe(401)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
