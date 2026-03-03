import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, X, Tag, EyeOff, Eye } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import CategoryDonutChart from './CategoryDonutChart'
import TimePeriodSelector, { getDateRange, getPreviousPeriodRange } from './TimePeriodSelector'
import { formatCurrency } from '../../utils/formatters'
import { STATEMENT_CATEGORIES } from '../../constants/categories'

/* ───────── helpers ───────── */

function filterByRange(transactions, start, end) {
  return transactions.filter(txn => {
    if (!txn.date) return false
    if (start && txn.date < start) return false
    if (end && txn.date > end) return false
    return true
  })
}

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-2.5 py-1.5 shadow-xl" style={{ background: '#111827', border: '1px solid #374151' }}>
      <p className="text-xs font-medium text-white">{label}</p>
      <p className="text-xs font-bold" style={{ color: payload[0]?.color || '#3b82f6' }}>
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

/* ───────── Transaction Detail Drawer ───────── */

function TransactionDrawer({ transaction, onClose, onUpdate }) {
  const [editCategory, setEditCategory] = useState(transaction.category || 'other')
  const [excluded, setExcluded] = useState(!!transaction.excluded)
  const hasChanges = editCategory !== (transaction.category || 'other') || excluded !== !!transaction.excluded

  const handleSave = () => {
    if (!hasChanges) { onClose(); return }
    onUpdate(transaction.id, { category: editCategory, excluded })
    onClose()
  }

  const cat = STATEMENT_CATEGORIES.find(c => c.key === editCategory)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 overflow-y-auto"
        style={{
          width: 'min(380px, 90vw)',
          background: 'var(--bg-card, #111827)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.4)',
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--bg-card, #111827)', borderBottom: '1px solid var(--border-subtle)', zIndex: 1 }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Transaction Detail</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Amount */}
          <div className="text-center py-3">
            <p
              className="text-3xl font-bold tabular-nums"
              style={{ color: transaction.amount < 0 ? 'var(--accent-emerald)' : 'var(--text-primary)' }}
            >
              {transaction.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(transaction.amount))}
            </p>
            {excluded && (
              <span className="inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full" style={{ background: '#ef444420', color: '#ef4444' }}>
                <EyeOff size={10} /> Excluded from totals
              </span>
            )}
          </div>

          {/* Details grid */}
          <div className="space-y-3">
            <DetailRow label="Merchant" value={transaction.merchantName || '—'} />
            <DetailRow label="Description" value={transaction.description || '—'} mono />
            <DetailRow
              label="Date"
              value={transaction.date
                ? new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
                : '—'
              }
            />
            {transaction.pending && (
              <DetailRow label="Status" value="Pending" color="#eab308" />
            )}
          </div>

          {/* Category selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
              <Tag size={11} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
              Category
            </label>
            <div className="space-y-1">
              {STATEMENT_CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setEditCategory(c.key)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all duration-100"
                  style={{
                    background: editCategory === c.key ? c.color + '18' : 'transparent',
                    border: '1px solid',
                    borderColor: editCategory === c.key ? c.color + '60' : 'transparent',
                    color: editCategory === c.key ? '#f9fafb' : 'var(--text-muted)',
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="font-medium">{c.label}</span>
                  {editCategory === c.key && c.key !== (transaction.category || 'other') && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                      new
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Exclude toggle */}
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              {excluded ? <EyeOff size={14} style={{ color: '#ef4444' }} /> : <Eye size={14} style={{ color: 'var(--text-muted)' }} />}
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Exclude from totals</span>
            </div>
            <button
              onClick={() => setExcluded(!excluded)}
              className="relative w-10 h-5 rounded-full transition-colors duration-200"
              style={{ background: excluded ? '#ef4444' : 'var(--border-subtle)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200"
                style={{
                  background: '#fff',
                  left: 2,
                  transform: excluded ? 'translateX(20px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{
              background: hasChanges ? 'var(--accent-blue)' : 'var(--bg-subtle)',
              color: hasChanges ? '#fff' : 'var(--text-muted)',
              cursor: hasChanges ? 'pointer' : 'default',
              opacity: hasChanges ? 1 : 0.5,
            }}
          >
            {hasChanges ? 'Save Changes' : 'No Changes'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0.8; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

function DetailRow({ label, value, mono, color }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p
        className={`text-sm ${mono ? 'font-mono' : ''}`}
        style={{ color: color || 'var(--text-primary)', wordBreak: 'break-word' }}
      >
        {value}
      </p>
    </div>
  )
}

/* ───────── Category Detail View ───────── */

function CategoryDetailView({ categoryKey, transactions, prevPeriodTransactions, onBack, onTransactionClick, categoryColor }) {
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [merchantFilter, setMerchantFilter] = useState(null)

  const cfg = STATEMENT_CATEGORIES.find(c => c.key === categoryKey) || { key: categoryKey, label: categoryKey, color: '#6b7280' }
  const color = categoryColor || cfg.color

  // Category transactions (expenses only for totals, all for listing)
  const categoryTxns = useMemo(() =>
    transactions.filter(t => (t.category || 'other') === categoryKey),
    [transactions, categoryKey]
  )

  const prevCategoryTxns = useMemo(() =>
    (prevPeriodTransactions || []).filter(t => (t.category || 'other') === categoryKey && t.amount > 0),
    [prevPeriodTransactions, categoryKey]
  )

  const total = useMemo(() => categoryTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [categoryTxns])
  const prevTotal = useMemo(() => prevCategoryTxns.reduce((s, t) => s + t.amount, 0), [prevCategoryTxns])
  const pctChange = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

  // Monthly trend (for this category)
  const monthlyTrend = useMemo(() => {
    const byMonth = {}
    for (const txn of categoryTxns) {
      if (txn.amount <= 0) continue
      const month = txn.date?.slice(0, 7)
      if (!month) continue
      byMonth[month] = (byMonth[month] || 0) + txn.amount
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([month, total]) => {
        const [yr, mo] = month.split('-')
        const label = new Date(Number(yr), Number(mo) - 1).toLocaleDateString('en-US', { month: 'short' })
        return { month: label, total: Math.round(total) }
      })
  }, [categoryTxns])

  // Merchant breakdown
  const merchants = useMemo(() => {
    const byMerchant = {}
    for (const txn of categoryTxns) {
      if (txn.amount <= 0) continue
      const name = txn.merchantName || txn.description || 'Unknown'
      if (!byMerchant[name]) byMerchant[name] = { total: 0, count: 0 }
      byMerchant[name].total += txn.amount
      byMerchant[name].count++
    }
    const maxTotal = Math.max(...Object.values(byMerchant).map(m => m.total), 1)
    return Object.entries(byMerchant)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data, pct: (data.total / maxTotal) * 100 }))
  }, [categoryTxns])

  // Sorted + filtered transactions
  const sortedTxns = useMemo(() => {
    let filtered = categoryTxns
    if (merchantFilter) {
      filtered = filtered.filter(t => (t.merchantName || t.description || 'Unknown') === merchantFilter)
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = (a.date || '').localeCompare(b.date || '')
      else if (sortField === 'amount') cmp = (a.amount || 0) - (b.amount || 0)
      else if (sortField === 'merchant') cmp = (a.merchantName || '').localeCompare(b.merchantName || '')
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [categoryTxns, sortField, sortDir, merchantFilter])

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={11} strokeWidth={1.75} style={{ color: 'var(--text-faint)', display: 'inline', verticalAlign: 'middle' }} />
    return sortDir === 'asc'
      ? <ArrowUp size={11} strokeWidth={2} style={{ color: color, display: 'inline', verticalAlign: 'middle' }} />
      : <ArrowDown size={11} strokeWidth={2} style={{ color: color, display: 'inline', verticalAlign: 'middle' }} />
  }

  return (
    <div className="space-y-4" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors duration-150"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-subtle, rgba(255,255,255,0.06))' }}
        >
          <ChevronLeft size={14} />
          Categories
        </button>
        <ChevronRight size={12} style={{ color: 'var(--text-faint)' }} />
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          {cfg.label}
        </span>
      </div>

      {/* Stats banner */}
      <div
        className="rounded-xl p-4"
        style={{ background: color + '0a', border: '1px solid ' + color + '25' }}
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{formatCurrency(total)}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {categoryTxns.filter(t => t.amount > 0).length} transaction{categoryTxns.filter(t => t.amount > 0).length !== 1 ? 's' : ''}
            </p>
          </div>
          {pctChange !== null && (
            <div className="flex items-center gap-1">
              {pctChange > 0
                ? <TrendingUp size={14} style={{ color: '#ef4444' }} />
                : <TrendingDown size={14} style={{ color: '#22c55e' }} />
              }
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: pctChange > 0 ? '#ef4444' : '#22c55e' }}
              >
                {pctChange > 0 ? '+' : ''}{Math.round(pctChange)}%
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>vs prev period</span>
            </div>
          )}
        </div>
      </div>

      {/* Monthly trend mini chart */}
      {monthlyTrend.length > 1 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Monthly Trend
          </p>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<MiniTooltip />} />
                <Bar dataKey="total" fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Merchant breakdown */}
      {merchants.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Top Merchants
          </p>
          <div className="space-y-2">
            {merchants.map(m => {
              const isActive = merchantFilter === m.name
              return (
                <button
                  key={m.name}
                  onClick={() => setMerchantFilter(isActive ? null : m.name)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-medium truncate max-w-[60%] transition-colors duration-100"
                      style={{ color: isActive ? color : 'var(--text-secondary, var(--text-primary))' }}
                    >
                      {m.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {m.count}x
                      </span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: isActive ? color : 'var(--text-primary)' }}>
                        {formatCurrency(m.total)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle, #1f2937)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${m.pct}%`, background: color, opacity: isActive ? 1 : 0.55 }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          {merchantFilter && (
            <button
              onClick={() => setMerchantFilter(null)}
              className="mt-2 text-xs flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ color, background: color + '15' }}
            >
              <X size={10} /> Clear filter: {merchantFilter}
            </button>
          )}
        </div>
      )}

      {/* Transactions list */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Transactions {merchantFilter ? `— ${merchantFilter}` : ''}
          <span className="ml-2 normal-case font-normal">({sortedTxns.length})</span>
        </p>
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-subtle, var(--bg-card))', borderBottom: '1px solid var(--border-subtle)' }}>
                <th
                  className="text-left px-3 py-1.5 cursor-pointer select-none"
                  style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  onClick={() => toggleSort('date')}
                >
                  Date <SortIcon field="date" />
                </th>
                <th
                  className="text-left px-3 py-1.5 cursor-pointer select-none"
                  style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  onClick={() => toggleSort('merchant')}
                >
                  Merchant <SortIcon field="merchant" />
                </th>
                <th
                  className="text-right px-3 py-1.5 cursor-pointer select-none"
                  style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  onClick={() => toggleSort('amount')}
                >
                  Amount <SortIcon field="amount" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTxns.slice(0, 50).map((txn, i) => (
                <tr
                  key={txn.id || i}
                  onClick={() => onTransactionClick?.(txn)}
                  className="transition-colors duration-100"
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle, rgba(255,255,255,0.02))',
                    cursor: onTransactionClick ? 'pointer' : 'default',
                  }}
                  onMouseEnter={e => { if (onTransactionClick) e.currentTarget.style.background = color + '0a' }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-subtle, rgba(255,255,255,0.02))' }}
                >
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                    {txn.date ? new Date(txn.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[200px] text-xs" style={{ color: 'var(--text-primary)' }}>
                    {txn.merchantName || txn.description || '—'}
                    {txn.pending && <span className="ml-1 text-[9px] italic" style={{ color: 'var(--text-muted)' }}>pending</span>}
                    {txn.excluded && <EyeOff size={10} className="inline ml-1" style={{ color: '#ef4444', verticalAlign: 'middle' }} />}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap text-xs"
                    style={{ color: txn.amount < 0 ? 'var(--accent-emerald)' : 'var(--text-primary)' }}
                  >
                    {txn.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(txn.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedTxns.length > 50 && (
            <div className="text-center py-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Showing first 50 of {sortedTxns.length}
            </div>
          )}
          {sortedTxns.length === 0 && (
            <div className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              No transactions{merchantFilter ? ` from ${merchantFilter}` : ''} in this period.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

/* ═══════════════ Main CategoryExplorer ═══════════════ */

export default function CategoryExplorer({ transactions = [], onTransactionUpdate }) {
  // Time period
  const [period, setPeriod] = useState('thisMonth')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Drill-down
  const [drillCategory, setDrillCategory] = useState(null)
  const [selectedTxn, setSelectedTxn] = useState(null)

  // Compute date range
  const range = useMemo(() => {
    if (period === 'custom') return { start: customStart || null, end: customEnd || null }
    return getDateRange(period)
  }, [period, customStart, customEnd])

  const prevRange = useMemo(() => {
    return getPreviousPeriodRange(period, customStart, customEnd)
  }, [period, customStart, customEnd])

  // Filter transactions
  const filteredTxns = useMemo(
    () => filterByRange(transactions, range.start, range.end),
    [transactions, range]
  )

  const prevPeriodTxns = useMemo(
    () => prevRange.start ? filterByRange(transactions, prevRange.start, prevRange.end) : [],
    [transactions, prevRange]
  )

  const handleCustomChange = useCallback((start, end) => {
    setCustomStart(start)
    setCustomEnd(end)
  }, [])

  const handleCategoryClick = useCallback((categoryKey) => {
    setDrillCategory(categoryKey)
  }, [])

  const handleBack = useCallback(() => {
    setDrillCategory(null)
  }, [])

  const handleTransactionClick = useCallback((txn) => {
    setSelectedTxn(txn)
  }, [])

  const handleTransactionUpdate = useCallback((txnId, updates) => {
    if (onTransactionUpdate) onTransactionUpdate(txnId, updates)
    // Update the selected transaction locally so the UI reflects changes immediately
    setSelectedTxn(prev => prev?.id === txnId ? { ...prev, ...updates } : prev)
  }, [onTransactionUpdate])

  return (
    <div className="space-y-4">
      {/* Time period selector */}
      <TimePeriodSelector
        value={period}
        onChange={setPeriod}
        customStart={customStart}
        customEnd={customEnd}
        onCustomChange={handleCustomChange}
      />

      {/* Main content */}
      {drillCategory ? (
        <CategoryDetailView
          categoryKey={drillCategory}
          transactions={filteredTxns}
          prevPeriodTransactions={prevPeriodTxns}
          onBack={handleBack}
          onTransactionClick={onTransactionUpdate ? handleTransactionClick : undefined}
          categoryColor={STATEMENT_CATEGORIES.find(c => c.key === drillCategory)?.color}
        />
      ) : (
        <CategoryDonutChart
          transactions={filteredTxns}
          onCategoryClick={handleCategoryClick}
        />
      )}

      {/* Transaction detail drawer */}
      {selectedTxn && (
        <TransactionDrawer
          transaction={selectedTxn}
          onClose={() => setSelectedTxn(null)}
          onUpdate={handleTransactionUpdate}
        />
      )}
    </div>
  )
}
