import jwt from 'jsonwebtoken'

// Set required env var before importing auth module
process.env.JWT_SECRET = 'test-secret-for-unit-tests-only-not-weak'

const { signToken, requirePremium, verifyToken } = await import('./auth.mjs')

describe('signToken', () => {
  it('includes tier in JWT payload and defaults to free', () => {
    const token = signToken('user@test.com')
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    expect(payload.tier).toBe('free')
  })

  it('includes the provided tier in JWT payload', () => {
    const token = signToken('user@test.com', { tier: 'premium' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    expect(payload.tier).toBe('premium')
  })
})

describe('requirePremium', () => {
  function makeEvent(token) {
    return { headers: { Authorization: token ? `Bearer ${token}` : '' } }
  }

  it('rejects requests with no token (401)', () => {
    const result = requirePremium(makeEvent(null))
    expect(result.error).toBeDefined()
    expect(result.error.statusCode).toBe(401)
  })

  it('rejects free tier users (403)', () => {
    const token = signToken('user@test.com', { tier: 'free' })
    const result = requirePremium(makeEvent(token))
    expect(result.error).toBeDefined()
    expect(result.error.statusCode).toBe(403)
    expect(result.error.message).toMatch(/premium/i)
  })

  it('accepts premium tier users', () => {
    const token = signToken('user@test.com', { tier: 'premium' })
    const result = requirePremium(makeEvent(token))
    expect(result.error).toBeUndefined()
    expect(result.user).toBeDefined()
    expect(result.user.tier).toBe('premium')
  })
})
