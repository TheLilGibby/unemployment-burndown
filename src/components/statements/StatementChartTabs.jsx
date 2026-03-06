import { useState, useMemo, useCallback } from 'react'
import { PieChart, BarChart3, Store, GitMerge } from 'lucide-react'
import CategoryDonutChart from './CategoryDonutChart'
import { CategoryDetailView } from './CategoryExplorer'
import MonthlySpendingBarChart from './MonthlySpendingBarChart'
import TopMerchantsChart from './TopMerchantsChart'
import CashFlowWaterfallChart from '../chart/CashFlowWaterfallChart'
import { STATEMENT_CATEGORIES, findCategory } from '../../constants/categories'
import { formatCurrency } from '../../utils/formatters'

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
  membersByUserId = {},
}) {
  const [activeId, setActiveId] = useState('categories')
  const [hoveredId, setHoveredId] = useState(null)
  const [selectedCategories, setSelectedCategories] = useState(new Set())
  const [drillCategory, setDrillCategory] = useState(null)

  const handleCategoryClick = useCallback((categoryKey) => {
    setDrillCategory(categoryKey)
  }, [])

  const handleDrillBack = useCallback(() => {
    setDrillCategory(null)
  }, [])

  const activeChart = CHART_DEFS.find(c => c.id === activeId)

  // Compute which categories exist in the data with their totals
  const availableCategories = useMemo(() => {
    const byCategory = {}
    for (const txn of transactions) {
      if (txn.amount <= 0) continue
      const cat = txn.category || 'other'
      byCategory[cat] = (byCategory[cat] || 0) + txn.amount
    }
    return STATEMENT_CATEGORIES
      .filter(c => byCategory[c.key])
      .map(c => ({ ...c, total: byCategory[c.key] }))
      .sort((a, b) => b.total - a.total)
  }, [transactions])

  // Filter transactions by selected categories
  const filteredTransactions = useMemo(() => {
    if (selectedCategories.size === 0) return transactions
    return transactions.filter(txn => {
      const cat = txn.category || 'other'
      return selectedCategories.has(cat)
    })
  }, [transactions, selectedCategories])

  function toggleCategory(key) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function clearFilters() {
    setSelectedCategories(new Set())
  }

  // Summary stats for the filter bar
  const filterSummary = useMemo(() => {
    if (selectedCategories.size === 0) return null
    const total = filteredTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
    const count = filteredTransactions.filter(t => t.amount > 0).length
    return { total, count }
  }, [filteredTransactions, selectedCategories])

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
                onClick={() => { setActiveId(chart.id); setDrillCategory(null) }}
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

      {/* Description strip + filter summary */}
      <div
        className="px-4 py-1.5 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-subtle, var(--bg-card))',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {activeChart?.desc}
        </p>
        {filterSummary && (
          <p className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {formatCurrency(filterSummary.total)} across {filterSummary.count} txn{filterSummary.count !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Category pill filters */}
      {availableCategories.length > 0 && (
        <div
          className="px-4 py-2.5"
          style={{
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-subtle, var(--bg-card))',
          }}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* All pill */}
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: selectedCategories.size === 0
                  ? 'var(--accent-blue)'
                  : 'var(--bg-input)',
                color: selectedCategories.size === 0
                  ? '#fff'
                  : 'var(--text-muted)',
                border: `1px solid ${selectedCategories.size === 0 ? 'var(--accent-blue)' : 'var(--border-input)'}`,
              }}
            >
              All
            </button>

            {availableCategories.map(cat => {
              const isSelected = selectedCategories.has(cat.key)
              return (
                <button
                  key={cat.key}
                  onClick={() => toggleCategory(cat.key)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150"
                  style={{
                    background: isSelected
                      ? `${cat.color}20`
                      : 'var(--bg-input)',
                    color: isSelected
                      ? cat.color
                      : 'var(--text-muted)',
                    border: `1px solid ${isSelected ? cat.color : 'var(--border-input)'}`,
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: cat.color }}
                  />
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Chart content */}
      <div className="p-4 sm:p-5">
        {activeId === 'categories' && (
          drillCategory ? (
            <CategoryDetailView
              categoryKey={drillCategory}
              transactions={filteredTransactions}
              onBack={handleDrillBack}
              categoryColor={findCategory(drillCategory)?.color}
              membersByUserId={membersByUserId}
            />
          ) : (
            <CategoryDonutChart
              transactions={filteredTransactions}
              onCategoryClick={handleCategoryClick}
            />
          )
        )}
        {activeId === 'monthly' && (
          <MonthlySpendingBarChart transactions={filteredTransactions} creditCards={creditCards} />
        )}
        {activeId === 'merchants' && (
          <TopMerchantsChart transactions={filteredTransactions} />
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
