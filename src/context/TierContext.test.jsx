import { renderHook } from '@testing-library/react'
import { TierProvider, useTier } from './TierContext'

function wrapper(user) {
  return function Wrapper({ children }) {
    return <TierProvider user={user}>{children}</TierProvider>
  }
}

describe('useTier', () => {
  it('defaults to free when no user is provided', () => {
    const { result } = renderHook(() => useTier(), { wrapper: wrapper(null) })
    expect(result.current.tier).toBe('free')
    expect(result.current.isPremium).toBe(false)
  })

  it('defaults to free when user has no tier', () => {
    const { result } = renderHook(() => useTier(), { wrapper: wrapper({ email: 'test@test.com' }) })
    expect(result.current.tier).toBe('free')
    expect(result.current.isPremium).toBe(false)
  })

  it('returns premium when user.tier is premium', () => {
    const { result } = renderHook(() => useTier(), { wrapper: wrapper({ email: 'test@test.com', tier: 'premium' }) })
    expect(result.current.tier).toBe('premium')
    expect(result.current.isPremium).toBe(true)
  })
})
