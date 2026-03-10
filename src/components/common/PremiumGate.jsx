import { useTier } from '../../context/TierContext'

const defaultFallback = (
  <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-800 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-200">
    <p className="font-medium">Bank sync is a premium feature</p>
    <p className="mt-1 text-sm">Upgrade to premium to connect your bank accounts and brokerage for automatic syncing.</p>
  </div>
)

export default function PremiumGate({ children, fallback = defaultFallback }) {
  const { isPremium } = useTier()

  if (isPremium) return children

  return fallback
}
