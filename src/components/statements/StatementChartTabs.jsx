import { useState } from 'react'
import { PieChart, BarChart3, Store, GitMerge } from 'lucide-react'
import CategoryExplorer from './CategoryExplorer'
import MonthlySpendingBarChart from './MonthlySpendingBarChart'
import TopMerchantsChart from './TopMerchantsChart'
import CashFlowWaterfallChart from '../chart/CashFlowWaterfallChart'

const CHART_DEFS = [
  {
    id: 'categories',
    Icon: PieChart,
    label: 'Categories',
    desc: 'Spending by category — click any category to drill down',
  },
  {
    id: 'monthly',
    Icon: BarChart3,
    label: 'Monthly Trend',
    desc: 'Monthly inflow vs outflow — see where money truly goes',
  },
  {
    id: 'merchants',
    Icon: Store,
    label: 'Top Merchants',
    desc: 'Where you spend the most',
  },
  {
    id: 'paymentflow',
    Icon: GitMerge,
    label: 'Payment Flow',
    desc: 'How income flows through expenses and credit card payments — the full money story',
  },
]

export default function StatementChartTabs({
  transactions = [], creditCards = [], expenses = [], subscriptions = [],
  monthlyIncome = 0, monthlyBenefits = 0, onTransactionUpdate,
  oneTimePurchases, oneTimeExpenses, oneTimeIncome,
  transactionLinks, txnToOverviewMap, onLinkTransaction, onUnlinkTransaction,
}) {
  const [activeId, setActiveId] = useState('categories')
  const [hoveredId, setHoveredId] = useState(null)

  const activeChart = CHART_DEFS.find(c => c.id === activeId)

  return (
    <div
      className="theme-card rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border-default)' }}
    >
      {/* Tab bar */}
      <div
        className="flex items-stretch overflow-x-auto"
        style={{
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-subtle, var(--bg-card))',
          scrollbarWidth: 'none',
        }}
      >
        {CHART_DEFS.map((chart, idx) => {
          const isActive = chart.id === activeId
          const isHovered = chart.id === hoveredId

          return (
            <div key={chart.id} className="relative flex items-stretch flex-shrink-0">
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

      {/* Description strip */}
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

      {/* Chart content */}
      <div className="p-4 sm:p-5">
        {activeId === 'categories' && (
          <CategoryExplorer
            transactions={transactions}
            onTransactionUpdate={onTransactionUpdate}
            oneTimePurchases={oneTimePurchases}
            oneTimeExpenses={oneTimeExpenses}
            oneTimeIncome={oneTimeIncome}
            transactionLinks={transactionLinks}
            txnToOverviewMap={txnToOverviewMap}
            onLinkTransaction={onLinkTransaction}
            onUnlinkTransaction={onUnlinkTransaction}
          />
        )}
        {activeId === 'monthly' && (
          <MonthlySpendingBarChart transactions={transactions} creditCards={creditCards} />
        )}
        {activeId === 'merchants' && (
          <TopMerchantsChart transactions={transactions} />
        )}
        {activeId === 'paymentflow' && (
          <CashFlowWaterfallChart
            expenses={expenses}
            subscriptions={subscriptions}
            creditCards={creditCards}
            monthlyIncome={monthlyIncome}
            monthlyBenefits={monthlyBenefits}
            ccTransactionsByCard={(() => {
              // Group transactions by cardId for the waterfall breakdown
              const byCard = {}
              for (const t of transactions) {
                if (!t.cardId) continue
                if (!byCard[t.cardId]) byCard[t.cardId] = []
                byCard[t.cardId].push(t)
              }
              return byCard
            })()}
          />
        )}
      </div>
    </div>
  )
}
