import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/test-utils'
import BurndownPageSkeleton from '../components/common/BurndownPageSkeleton'
import SavingsPanel from '../components/finances/SavingsPanel'
import ExpensePanel from '../components/finances/ExpensePanel'
import ChartTabsSection from '../components/chart/ChartTabsSection'

// Mock heavy chart dependencies that don't render in jsdom
vi.mock('../components/chart/BurndownChart', () => ({
  default: () => <div data-testid="burndown-chart">BurndownChart</div>,
}))
vi.mock('../components/chart/BurnRateChart', () => ({
  default: () => <div data-testid="burn-rate-chart">BurnRateChart</div>,
}))
vi.mock('../components/chart/IncomeVsExpensesChart', () => ({
  default: () => <div data-testid="cashflow-chart">CashFlowChart</div>,
}))
vi.mock('../components/chart/ExpenseDonutChart', () => ({
  default: () => <div data-testid="expense-donut-chart">ExpenseDonutChart</div>,
}))
vi.mock('../components/chart/TopExpensesChart', () => ({
  default: () => <div data-testid="top-expenses-chart">TopExpensesChart</div>,
}))
vi.mock('../components/chart/IncomeCompositionChart', () => ({
  default: () => <div data-testid="income-composition-chart">IncomeCompositionChart</div>,
}))
vi.mock('../components/chart/NetPositionChart', () => ({
  default: () => <div data-testid="net-position-chart">NetPositionChart</div>,
}))
vi.mock('../components/chart/SnapshotDatePicker', () => ({
  default: () => <div data-testid="snapshot-date-picker">SnapshotDatePicker</div>,
}))
vi.mock('../hooks/useChartColors', () => ({
  useChartColors: () => ({
    blue: '#3b82f6',
    purple: '#8b5cf6',
    withAlpha: (color, alpha) => color,
  }),
}))
vi.mock('../hooks/useSnapTrade', () => ({
  useSnapTrade: () => ({
    connections: [],
    loading: false,
    syncing: false,
    lastSync: null,
    error: null,
    hasFetched: true,
    fetchAccounts: vi.fn().mockResolvedValue([]),
    syncAll: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    reconnect: vi.fn(),
  }),
}))
vi.mock('../context/CommentsContext', () => ({
  useComments: () => ({ getCommentCount: () => 0 }),
  CommentsProvider: ({ children }) => children,
}))

describe('BurndownPageSkeleton', () => {
  it('renders the runway banner skeleton', () => {
    render(<BurndownPageSkeleton />)
    // The skeleton renders a main element
    const main = document.querySelector('main')
    expect(main).toBeTruthy()
  })

  it('renders multiple skeleton sections', () => {
    const { container } = render(<BurndownPageSkeleton />)
    // Should have multiple theme-card sections (runway banner + chart + panels)
    const cards = container.querySelectorAll('.theme-card')
    expect(cards.length).toBeGreaterThanOrEqual(3)
  })

  it('renders within a max-width container', () => {
    const { container } = render(<BurndownPageSkeleton />)
    const main = container.querySelector('main')
    expect(main.className).toContain('max-w-5xl')
  })
})

describe('SavingsPanel loading skeleton', () => {
  it('shows skeleton when loading=true', () => {
    render(
      <SavingsPanel
        accounts={[]}
        onChange={vi.fn()}
        loading={true}
      />
    )
    expect(screen.getByTestId('savings-panel-skeleton')).toBeInTheDocument()
  })

  it('shows panel content when loading=false', () => {
    render(
      <SavingsPanel
        accounts={[]}
        onChange={vi.fn()}
        loading={false}
      />
    )
    expect(screen.queryByTestId('savings-panel-skeleton')).not.toBeInTheDocument()
    // "Add Account" button should be present
    expect(screen.getByText('+ Add Account')).toBeInTheDocument()
  })

  it('does not show skeleton by default (loading defaults to false)', () => {
    render(
      <SavingsPanel
        accounts={[]}
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByTestId('savings-panel-skeleton')).not.toBeInTheDocument()
  })
})

describe('ExpensePanel loading skeleton', () => {
  it('shows skeleton when loading=true', () => {
    render(
      <ExpensePanel
        expenses={[]}
        onChange={vi.fn()}
        loading={true}
      />
    )
    expect(screen.getByTestId('expense-panel-skeleton')).toBeInTheDocument()
  })

  it('shows panel content when loading=false', () => {
    render(
      <ExpensePanel
        expenses={[]}
        onChange={vi.fn()}
        loading={false}
      />
    )
    expect(screen.queryByTestId('expense-panel-skeleton')).not.toBeInTheDocument()
    expect(screen.getByText('+ Add Expense')).toBeInTheDocument()
  })

  it('does not show skeleton by default', () => {
    render(
      <ExpensePanel
        expenses={[]}
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByTestId('expense-panel-skeleton')).not.toBeInTheDocument()
  })
})

describe('ChartTabsSection loading skeleton', () => {
  const defaultProps = {
    dataPoints: [],
    runoutDate: null,
    baseDataPoints: null,
    benefitStart: null,
    benefitEnd: null,
    emergencyFloor: 0,
    showEssentials: false,
    showBaseline: false,
    expenses: [],
    subscriptions: [],
    creditCards: [],
    investments: [],
    monthlyBenefits: 0,
    availableDates: [],
    selectedHistoricalDate: null,
    historicalBurndown: null,
    snapshotLoading: false,
    onHistoricalDateSelect: vi.fn(),
  }

  it('shows chart loading skeleton when loading=true', () => {
    render(<ChartTabsSection {...defaultProps} loading={true} />)
    expect(screen.getByTestId('chart-loading-skeleton')).toBeInTheDocument()
  })

  it('hides chart loading skeleton when loading=false', () => {
    render(<ChartTabsSection {...defaultProps} loading={false} />)
    expect(screen.queryByTestId('chart-loading-skeleton')).not.toBeInTheDocument()
  })

  it('does not show chart skeleton by default', () => {
    render(<ChartTabsSection {...defaultProps} />)
    expect(screen.queryByTestId('chart-loading-skeleton')).not.toBeInTheDocument()
  })

  it('renders tab buttons regardless of loading state', () => {
    render(<ChartTabsSection {...defaultProps} loading={true} />)
    // Tab labels should still be visible
    expect(screen.getByText('Balance')).toBeInTheDocument()
    expect(screen.getByText('Burn Rate')).toBeInTheDocument()
  })
})
