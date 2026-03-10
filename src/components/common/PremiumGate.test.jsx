import { render, screen } from '../../test/test-utils'
import { TierProvider } from '../../context/TierContext'
import PremiumGate from './PremiumGate'

function renderWithTier(ui, { tier } = {}) {
  const user = tier ? { tier } : null
  return render(
    <TierProvider user={user}>
      {ui}
    </TierProvider>
  )
}

describe('PremiumGate', () => {
  it('shows children for premium users', () => {
    renderWithTier(
      <PremiumGate><span>Premium content</span></PremiumGate>,
      { tier: 'premium' }
    )
    expect(screen.getByText('Premium content')).toBeInTheDocument()
  })

  it('shows default fallback for free users', () => {
    renderWithTier(
      <PremiumGate><span>Premium content</span></PremiumGate>,
      { tier: 'free' }
    )
    expect(screen.queryByText('Premium content')).not.toBeInTheDocument()
    expect(screen.getByText('Bank sync is a premium feature')).toBeInTheDocument()
  })

  it('shows custom fallback for free users', () => {
    renderWithTier(
      <PremiumGate fallback={<span>Custom fallback</span>}>
        <span>Premium content</span>
      </PremiumGate>,
      { tier: 'free' }
    )
    expect(screen.queryByText('Premium content')).not.toBeInTheDocument()
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })
})
