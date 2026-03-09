import { render, screen } from '../../test/test-utils'
import BurndownChart from './BurndownChart'
import BurnRateChart from './BurnRateChart'
import IncomeVsExpensesChart from './IncomeVsExpensesChart'
import IncomeCompositionChart from './IncomeCompositionChart'
import ComparisonChart from './ComparisonChart'

// Recharts uses ResizeObserver which is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('BurndownChart empty state', () => {
  it('renders empty state message when dataPoints is empty array', () => {
    render(<BurndownChart dataPoints={[]} />)
    expect(screen.getByText('No burndown data to display yet.')).toBeTruthy()
  })

  it('renders empty state message when dataPoints is undefined', () => {
    render(<BurndownChart dataPoints={undefined} />)
    expect(screen.getByText('No burndown data to display yet.')).toBeTruthy()
  })

  it('renders chart when dataPoints has data', () => {
    const dataPoints = [
      { month: 0, balance: 50000, balanceEssentialOnly: 50000, netBurn: 2000, income: 0, dateLabel: 'Mar 2026', date: '2026-03-01' },
      { month: 1, balance: 48000, balanceEssentialOnly: 49000, netBurn: 2000, income: 0, dateLabel: 'Apr 2026', date: '2026-04-01' },
    ]
    render(<BurndownChart dataPoints={dataPoints} />)
    expect(screen.queryByText('No burndown data to display yet.')).toBeNull()
  })
})

describe('BurnRateChart empty state', () => {
  it('renders empty state message when dataPoints is empty array', () => {
    render(<BurnRateChart dataPoints={[]} />)
    expect(screen.getByText('No burn rate data to display yet.')).toBeTruthy()
  })

  it('renders empty state message when dataPoints is undefined', () => {
    render(<BurnRateChart dataPoints={undefined} />)
    expect(screen.getByText('No burn rate data to display yet.')).toBeTruthy()
  })

  it('renders chart when dataPoints has data', () => {
    const dataPoints = [
      { month: 1, netBurn: 1500, income: 0, dateLabel: 'Apr 2026', inBenefitWindow: false, jobActive: false, oneTimeCost: null },
      { month: 2, netBurn: 1500, income: 0, dateLabel: 'May 2026', inBenefitWindow: false, jobActive: false, oneTimeCost: null },
    ]
    render(<BurnRateChart dataPoints={dataPoints} />)
    expect(screen.queryByText('No burn rate data to display yet.')).toBeNull()
  })
})

describe('IncomeVsExpensesChart empty state', () => {
  it('renders empty state message when dataPoints is empty array', () => {
    render(<IncomeVsExpensesChart dataPoints={[]} />)
    expect(screen.getByText('No income or expense data to display yet.')).toBeTruthy()
  })

  it('renders empty state message when dataPoints is undefined', () => {
    render(<IncomeVsExpensesChart dataPoints={undefined} />)
    expect(screen.getByText('No income or expense data to display yet.')).toBeTruthy()
  })

  it('renders chart when dataPoints has data', () => {
    const dataPoints = [
      { month: 1, income: 2000, netBurn: 500, dateLabel: 'Apr 2026', inBenefitWindow: false, jobActive: false },
      { month: 2, income: 2000, netBurn: 500, dateLabel: 'May 2026', inBenefitWindow: false, jobActive: false },
    ]
    render(<IncomeVsExpensesChart dataPoints={dataPoints} />)
    expect(screen.queryByText('No income or expense data to display yet.')).toBeNull()
  })
})

describe('IncomeCompositionChart empty state', () => {
  it('renders empty state message when dataPoints is empty array', () => {
    render(<IncomeCompositionChart dataPoints={[]} monthlyBenefits={0} />)
    expect(screen.getByText('No income composition data to display yet.')).toBeTruthy()
  })

  it('renders empty state message when dataPoints is undefined', () => {
    render(<IncomeCompositionChart dataPoints={undefined} monthlyBenefits={0} />)
    expect(screen.getByText('No income composition data to display yet.')).toBeTruthy()
  })
})

describe('ComparisonChart empty state', () => {
  it('renders empty state message when scenarioA is null', () => {
    render(<ComparisonChart scenarioA={null} scenarioB={null} />)
    expect(screen.getByText('Select two scenarios to compare.')).toBeTruthy()
  })

  it('renders empty state message when scenarioB is undefined', () => {
    render(<ComparisonChart scenarioA={{ label: 'A', dataPoints: [] }} scenarioB={undefined} />)
    expect(screen.getByText('Select two scenarios to compare.')).toBeTruthy()
  })
})
