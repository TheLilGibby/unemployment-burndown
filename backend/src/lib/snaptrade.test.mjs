import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isSnapTradeConfigured } from './snaptrade.mjs'

describe('isSnapTradeConfigured', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns true when both env vars are set', () => {
    process.env.SNAPTRADE_CLIENT_ID = 'test-client-id'
    process.env.SNAPTRADE_API_SECRET = 'test-api-secret'
    expect(isSnapTradeConfigured()).toBe(true)
  })

  it('returns false when SNAPTRADE_CLIENT_ID is missing', () => {
    delete process.env.SNAPTRADE_CLIENT_ID
    process.env.SNAPTRADE_API_SECRET = 'test-api-secret'
    expect(isSnapTradeConfigured()).toBe(false)
  })

  it('returns false when SNAPTRADE_API_SECRET is missing', () => {
    process.env.SNAPTRADE_CLIENT_ID = 'test-client-id'
    delete process.env.SNAPTRADE_API_SECRET
    expect(isSnapTradeConfigured()).toBe(false)
  })

  it('returns false when both env vars are missing', () => {
    delete process.env.SNAPTRADE_CLIENT_ID
    delete process.env.SNAPTRADE_API_SECRET
    expect(isSnapTradeConfigured()).toBe(false)
  })

  it('returns false when env vars are empty strings', () => {
    process.env.SNAPTRADE_CLIENT_ID = ''
    process.env.SNAPTRADE_API_SECRET = ''
    expect(isSnapTradeConfigured()).toBe(false)
  })
})
