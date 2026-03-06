import { useState } from 'react'
import dayjs from 'dayjs'
import { TrendingDown, Flame, ArrowLeftRight, PieChart, BarChart2, BarChart3, Scale } from 'lucide-react'
import BurndownChart from './BurndownChart'
import SnapshotDatePicker from './SnapshotDatePicker'
import BurnRateChart from './BurnRateChart'
import IncomeVsExpensesChart from './IncomeVsExpensesChart'
import ExpenseDonutChart from './ExpenseDonutChart'
import TopExpensesChart from './TopExpensesChart'
import IncomeCompositionChart from './IncomeCompositionChart'
import NetPositionChart from './NetPositionChart'

// ─── Chart registry ───────────────────────────────────────────────────────────
const CHART_DEFS = [
  {
    id:   'burndown',
    Icon: TrendingDown,
    label: 'Balance',
    desc:  'Savings balance over time — the core runway burndown view',
  },
  {
    id:   'netposition',
    Icon: Scale,
    label: 'Net Position',
    desc:  'Cash minus credit card debt — your true financial position over time',
  },
  {
    id:   'burnrate',
    Icon: Flame,
    label: 'Burn Rate',
    desc:  'Monthly net cash change — red when drawing down, green when income exceeds expenses',
  },
  {
    id:   'cashflow',
    Icon: ArrowLeftRight,
    label: 'Cash Flow',
    desc:  'Side-by-side income vs. outflow bars — see which months are covered',
  },
  {
    id:   'expensemix',
    Icon: PieChart,
    label: 'Expense Mix',
    desc:  'Donut breakdown of spending: essential, discretionary, subscriptions & more',
  },
  {
    id:   'topspend',
    Icon: BarChart2,
    label: 'Top Costs',
    desc:  'All expense line-items ranked by monthly cost — spot your biggest drains',
  },
  {
    id:   'incomemix',
    Icon: BarChart3,
    label: 'Income Mix',
    desc:  'Stacked income sources over time with outflow overlay',
  },
]

// ─── Main component ───────────────────────────────────────────────────────────
export default function ChartTabsSection({
  // BurndownChart props
  dataPoints,
  runoutDate,
  baseDataPoints,
  benefitStart,
  benefitEnd,
  emergencyFloor,
  showEssentials,
  showBaseline,
  // Expense data
  expenses,
  subscriptions,
  creditCards,
  investments,
  // Derived income
  monthlyBenefits,
  // Historical snapshot comparison
  availableDates,
  selectedHistoricalDate,
  historicalBurndown,
  snapshotLoading,
  onHistoricalDateSelect,
}) {
  const [activeId, setActiveId] = useState('burndown')
  const [hoveredId, setHoveredId] = useState(null)

  const activeChart = CHART_DEFS.find(c => c.id === activeId)

  return (
    <div
      id="sec-chart"
      className="theme-card rounded-xl border scroll-mt-20 overflow-hidden"
      style={{ borderColor: 'var(--border-default)' }}
    >
      {/* ── Tab bar ── */}
      <div
        className="flex items-stretch overflow-x-auto"
        style={{
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-subtle, var(--bg-card))',
          scrollbarWidth: 'none',
        }}
      >
        {CHART_DEFS.map((chart, idx) => {
          const isActive  = chart.id === activeId
          const isHovered = chart.id === hoveredId

          return (
            <div key={chart.id} className="relative flex items-stretch flex-shrink-0">
              {/* Subtle separator between tabs */}
              {idx > 0 && (
                <div
                  className="w-px self-stretch"
                  style={{ background: 'var(--border-subtle)', opacity: 0.6 }}
                />
              )}

              <button
                onClick={() => setActiveId(chart.id)}
                onMouseEnter={() => setHoveredId(chart.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="relative flex items-center gap-1.5 px-3.5 py-3 text-sm font-medium transition-all duration-150"
                style={{
                  color: isActive
                    ? 'var(--text-primary)'
                    : isHovered
                      ? 'var(--text-secondary, var(--text-primary))'
                      : 'var(--text-muted)',
                  background: isActive
                    ? 'var(--bg-card)'
                    : isHovered
                      ? 'var(--bg-hover, rgba(255,255,255,0.04))'
                      : 'transparent',
                }}
                title={chart.desc}
              >
                <chart.Icon size={15} strokeWidth={1.75} />
                <span className="hidden sm:inline whitespace-nowrap">{chart.label}</span>

                {/* Active underline */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: 2, background: 'var(--accent-blue, #3b82f6)', borderRadius: '1px 1px 0 0' }}
                  />
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Description strip ── */}
      <div
        className="px-4 py-1.5"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-subtle, var(--bg-card))',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {activeChart?.desc}
        </p>
      </div>

      {/* ── Chart content ── */}
      <div className="p-4 sm:p-5">
        {activeId === 'burndown' && (
          <div className="space-y-3">
            {/* Historical snapshot date picker */}
            <SnapshotDatePicker
              availableDates={availableDates}
              selectedDate={selectedHistoricalDate}
              onChange={onHistoricalDateSelect}
              loading={snapshotLoading}
            />
            {/* Context badge when a historical snapshot is active */}
            {selectedHistoricalDate && historicalBurndown && (
              <div
                className="flex flex-wrap items-center gap-2 text-xs px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.25)',
                  color: '#a78bfa',
                }}
              >
                <span>Comparing with snapshot from <strong>{dayjs(selectedHistoricalDate).format('MMMM D, YYYY')}</strong></span>
                <span style={{ opacity: 0.6 }}>— dashed line shows the projection as it stood on that date</span>
              </div>
            )}
            <BurndownChart
              dataPoints={dataPoints}
              runoutDate={runoutDate}
              baseDataPoints={historicalBurndown ? historicalBurndown.dataPoints : baseDataPoints}
              baselineLabel={
                selectedHistoricalDate
                  ? `Snapshot from ${dayjs(selectedHistoricalDate).format('MMM D, YYYY')}`
                  : 'No what-if baseline'
              }
              benefitStart={benefitStart}
              benefitEnd={benefitEnd}
              emergencyFloor={emergencyFloor}
              showEssentials={showEssentials}
              showBaseline={showBaseline}
            />
          </div>
        )}
        {activeId === 'netposition' && (
          <NetPositionChart dataPoints={dataPoints} />
        )}
        {activeId === 'burnrate' && (
          <BurnRateChart dataPoints={dataPoints} />
        )}
        {activeId === 'cashflow' && (
          <IncomeVsExpensesChart dataPoints={dataPoints} />
        )}
        {activeId === 'expensemix' && (
          <ExpenseDonutChart
            expenses={expenses}
            subscriptions={subscriptions}
            creditCards={creditCards}
            investments={investments}
          />
        )}
        {activeId === 'topspend' && (
          <TopExpensesChart
            expenses={expenses}
            subscriptions={subscriptions}
            creditCards={creditCards}
            investments={investments}
          />
        )}
        {activeId === 'incomemix' && (
          <IncomeCompositionChart
            dataPoints={dataPoints}
            monthlyBenefits={monthlyBenefits}
          />
        )}
      </div>
    </div>
  )
}
