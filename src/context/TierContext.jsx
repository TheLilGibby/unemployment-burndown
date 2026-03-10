import { createContext, useContext, useMemo } from 'react'

const TierContext = createContext({ tier: 'free', isPremium: false })

export function TierProvider({ children, user }) {
  const value = useMemo(() => {
    const tier = user?.tier || 'free'
    return { tier, isPremium: tier === 'premium' }
  }, [user?.tier])

  return (
    <TierContext.Provider value={value}>
      {children}
    </TierContext.Provider>
  )
}

export function useTier() {
  return useContext(TierContext)
}
