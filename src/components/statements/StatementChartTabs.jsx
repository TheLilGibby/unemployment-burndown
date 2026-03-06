import { useState, useMemo, useCallback } from 'react'
import { PieChart, BarChart3, Store, GitMerge, Filter, X, EyeOff } from 'lucide-react'
import CategoryDonutChart from './CategoryDonutChart'
import { CategoryDetailView, TransactionDrawer, loadRecentCategoryKeys, saveRecentCategoryKey } from './CategoryExplorer'
import MonthlySpendingBarChart from './MonthlySpendingBarChart'
import TopMerchantsChart from './TopMerchantsChart'
import CashFlowWaterfallChart from '../chart/CashFlowWaterfallChart'
import TimePeriodSelector, { getDateRange } from './TimePeriodSelector'
import { STATEMENT_CATEGORIES, findCategory, getParentCategoryKey } from '../../constants/categories'
import { formatCurrency } from '../../utils/formatters'
import TransactionLinkModal from '../linking/TransactionLinkModal'

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

function filterByRange(transactions, start, end) {
  return transactions.filter(txn => {
    if (!txn.date) return false
    if (start && txn.date < start) return false
    if (end && txn.date > end) return false
    return true
  })
}

export default function StatementChartTabs({
  transactions = [], creditCards = [], expenses = [], subscriptions = [],
  monthlyIncome = 0, monthlyBenefits = 0, onTransactionUpdate,
  oneTimePurchases, oneTimeExpenses, oneTimeIncome,
  transactionLinks, txnToOverviewMap, onLinkTransaction, onUnlinkTransaction,
  membersByUserId = {},
}) {
  const [activeId, setActiveId] = useState('categories')
  const [hoveredId, setHoveredId] = useState(null)
  const [drillCategory, setDrillCategory] = useState(null)

  // Time period
  const [period, setPeriod] = useState('thisMonth')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Category filters (collapsible)
  const [showFilters, setShowFilters] = useState(false)
  const [hiddenCategories, setHiddenCategories] = useState(new Set())

  // Transaction drawer state
  const [selectedTxn, setSelectedTxn] = useState(null)
  const [linkModalTxn, setLinkModalTxn] = useState(null)
  const [recentCategoryKeys, setRecentCategoryKeys] = useState(loadRecentCategoryKeys)

  const recentCategories = useMemo(() => {
    return recentCategoryKeys.map(key => findCategory(key)).filter(Boolean)
  }, [recentCategoryKeys])

  const hasLinking = !!(onLinkTransaction && (oneTimePurchases?.length || oneTimeExpenses?.length || oneTimeIncome?.length))

  const overviewItemsByKey = useMemo(() => {
    const map = {}
    for (const p of (oneTimePurchases || [])) map[`otp_${p.id}`] = { ...p, _type: 'otp' }
    for (const e of (oneTimeExpenses || [])) map[`ote_${e.id}`] = { ...e, _type: 'ote' }
    for (const i of (oneTimeIncome || [])) map[`oti_${i.id}`] = { ...i, _type: 'oti' }
    return map
  }, [oneTimePurchases, oneTimeExpenses, oneTimeIncome])

  const handleTransactionClick = useCallback((txn) => {
    setSelectedTxn(txn)
  }, [])

  const handleTransactionUpdate = useCallback((txnId, updates, statementId) => {
    if (onTransactionUpdate) onTransactionUpdate(txnId, updates, statementId)
    if (updates.category) {
      const newKeys = saveRecentCategoryKey(updates.category)
      setRecentCategoryKeys(newKeys)
    }
    setSelectedTxn(prev => prev?.id === txnId ? { ...prev, ...updates } : prev)
  }, [onTransactionUpdate])

  const handleCategoryClick = useCallback((categoryKey) => {
    setDrillCategory(categoryKey)
  }, [])

  const handleDrillBack = useCallback(() => {
    setDrillCategory(null)
  }, [])

  const handleCustomChange = useCallback((start, end) => {
    setCustomStart(start)
    setCustomEnd(end)
  }, [])

  const activeChart = CHART_DEFS.find(c => c.id === activeId)

  // Compute date range
  const range = useMemo(() => {
    if (period === 'custom') return { start: customStart || null, end: customEnd || null }
    return getDateRange(period)
  }, [period, customStart, customEnd])

  // Filter transactions by date range
  const dateFilteredTxns = useMemo(
    () => filterByRange(transactions, range.start, range.end),
    [transactions, range]
  )

  // Filter by hidden categories (resolve to parent key so sub-categories roll up correctly)
  const filteredTransactions = useMemo(() => {
    if (hiddenCategories.size === 0) return dateFilteredTxns
    return dateFilteredTxns.filter(txn => {
      const parentKey = getParentCategoryKey(txn.category || 'other_general')
      return !hiddenCategories.has(parentKey)
    })
  }, [dateFilteredTxns, hiddenCategories])

  function toggleHideCategory(key) {
    setHiddenCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function clearFilters() {
    setHiddenCategories(new Set())
  }

  // Available categories for filter pills (group by parent key so sub-categories roll up)
  const availableCategories = useMemo(() => {
    const byCategory = {}
    for (const txn of dateFilteredTxns) {
      if (txn.amount <= 0) continue
      const parentKey = getParentCategoryKey(txn.category || 'other_general')
      byCategory[parentKey] = (byCategory[parentKey] || 0) + txn.amount
    }
    return STATEMENT_CATEGORIES
      .filter(c => byCategory[c.key])
      .map(c => ({ ...c, total: byCategory[c.key] }))
      .sort((a, b) => b.total - a.total)
  }, [dateFilteredTxns])

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

      {/* Time period selector + Filters toggle */}
      <div
        className="px-4 py-3 space-y-2"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-subtle, var(--bg-card))',
        }}
      >
        <TimePeriodSelector
          value={period}
          onChange={setPeriod}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={handleCustomChange}
        />

        {/* Filters row: toggle button + active filter pills inline */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters(v => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150 flex-shrink-0"
            style={{
              background: showFilters || hiddenCategories.size > 0
                ? 'color-mix(in srgb, var(--accent-blue) 15%, transparent)'
                : 'var(--bg-subtle, rgba(255,255,255,0.06))',
              color: showFilters || hiddenCategories.size > 0
                ? 'var(--accent-blue)'
                : 'var(--text-muted)',
              border: '1px solid',
              borderColor: showFilters || hiddenCategories.size > 0
                ? 'color-mix(in srgb, var(--accent-blue) 30%, transparent)'
                : 'var(--border-subtle)',
            }}
          >
            <Filter size={12} />
            Filters
            {hiddenCategories.size > 0 && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                style={{ background: 'var(--accent-blue)', color: '#fff' }}
              >
                {hiddenCategories.size}
              </span>
            )}
          </button>

          {/* Active filter pills — one per hidden category */}
          {[...hiddenCategories].map(key => {
            const cat = STATEMENT_CATEGORIES.find(c => c.key === key)
            if (!cat) return null
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full"
                style={{
                  background: cat.color + '18',
                  color: cat.color,
                  border: '1px solid ' + cat.color + '40',
                }}
              >
                <EyeOff size={11} style={{ opacity: 0.8 }} />
                {cat.label}
                <button
                  onClick={() => toggleHideCategory(key)}
                  className="flex-shrink-0 transition-opacity"
                  style={{ opacity: 0.65, lineHeight: 0 }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.65}
                  title={`Remove "${cat.label}" filter`}
                >
                  <X size={11} />
                </button>
              </span>
            )
          })}
        </div>

        {/* Collapsible category picker — click to toggle hide/show */}
        {showFilters && availableCategories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {availableCategories.map(cat => {
              const isHidden = hiddenCategories.has(cat.key)
              return (
                <button
                  key={cat.key}
                  onClick={() => toggleHideCategory(cat.key)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150"
                  style={{
                    background: isHidden ? 'var(--bg-subtle, rgba(255,255,255,0.06))' : cat.color + '20',
                    color: isHidden ? 'var(--text-muted)' : cat.color,
                    border: '1px solid',
                    borderColor: isHidden ? 'var(--border-subtle)' : cat.color + '40',
                    opacity: isHidden ? 0.45 : 1,
                    textDecoration: isHidden ? 'line-through' : 'none',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: cat.color, opacity: isHidden ? 0.3 : 1 }}
                  />
                  {cat.label}
                </button>
              )
            })}
            {hiddenCategories.size > 0 && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full transition-all duration-150"
                style={{ color: 'var(--accent-blue)', background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' }}
              >
                <X size={10} />
                Reset all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Transaction detail drawer */}
      {selectedTxn && (() => {
        const selLinkedKey = txnToOverviewMap?.[selectedTxn.id] || null
        const selLinkedItem = selLinkedKey ? overviewItemsByKey[selLinkedKey] : null
        return (
          <TransactionDrawer
            transaction={selectedTxn}
            onClose={() => setSelectedTxn(null)}
            onUpdate={handleTransactionUpdate}
            linkedItem={selLinkedItem}
            linkedKey={selLinkedKey}
            onOpenLinkModal={hasLinking ? (txn) => setLinkModalTxn(txn) : undefined}
            onUnlink={onUnlinkTransaction ? (key, txnId) => onUnlinkTransaction(key, txnId) : undefined}
            recentCategories={recentCategories}
            membersByUserId={membersByUserId}
          />
        )
      })()}

      {/* Transaction link modal */}
      {linkModalTxn && (
        <TransactionLinkModal
          open={true}
          transaction={linkModalTxn}
          oneTimePurchases={oneTimePurchases}
          oneTimeExpenses={oneTimeExpenses}
          oneTimeIncome={oneTimeIncome}
          transactionLinks={transactionLinks}
          txnToOverviewMap={txnToOverviewMap}
          onLink={(overviewKey, txn) => {
            onLinkTransaction(overviewKey, txn)
            setLinkModalTxn(null)
          }}
          onUnlink={(overviewKey, txnId) => {
            onUnlinkTransaction(overviewKey, txnId)
            setLinkModalTxn(null)
          }}
          onClose={() => setLinkModalTxn(null)}
        />
      )}

      {/* Chart content */}
      <div className="p-4 sm:p-5">
        {activeId === 'categories' && (
          drillCategory ? (
            <CategoryDetailView
              categoryKey={drillCategory}
              transactions={filteredTransactions}
              onBack={handleDrillBack}
              onTransactionClick={(onTransactionUpdate || hasLinking) ? handleTransactionClick : undefined}
              categoryColor={findCategory(drillCategory)?.color}
              txnToOverviewMap={hasLinking ? txnToOverviewMap : undefined}
              membersByUserId={membersByUserId}
            />
          ) : (
            <CategoryDonutChart
              transactions={filteredTransactions}
              onCategoryClick={handleCategoryClick}
              hiddenCategories={hiddenCategories}
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
              for (const t of filteredTransactions) {
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
