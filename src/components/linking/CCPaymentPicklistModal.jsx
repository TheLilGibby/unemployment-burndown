import { useState, useMemo } from 'react'
import { X, CreditCard, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { findCategory, resolveCategory } from '../../constants/categories'
import { summarizePicklistByCategory } from '../../utils/ccStatementPicklist'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Modal that shows the credit card statement transactions covered by a
 * detected CC payment from a bank account.
 *
 * Surfaces the financial flow:  Bank payment → individual CC charges.
 */
export default function CCPaymentPicklistModal({
  open,
  bankTxn,
  matchedCardName,
  coverage,
  transactions = [],
  onClose,
}) {
  const [showCategories, setShowCategories] = useState(true)
  const [filterCategory, setFilterCategory] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const categorySummary = useMemo(
    () => summarizePicklistByCategory(transactions.filter(t => (t.amount || 0) > 0)),
    [transactions],
  )

  const filtered = useMemo(() => {
    let txns = [...transactions]
    if (filterCategory) {
      txns = txns.filter(t => resolveCategory(t.category || 'other_general') === filterCategory)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      txns = txns.filter(t =>
        (t.merchantName || '').toLowerCase().includes(term) ||
        (t.description || '').toLowerCase().includes(term),
      )
    }
    return txns.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [transactions, filterCategory, searchTerm])

  if (!open || !bankTxn) return null

  const hasGap = coverage && Math.abs(coverage.difference) > 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative rounded-xl border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <CreditCard size={14} style={{ color: '#fb923c' }} />
                CC Payment Breakdown
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                What this payment covered
              </p>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Payment flow visualization */}
          <div
            className="mt-3 flex items-center gap-2 p-3 rounded-lg"
            style={{ background: 'var(--bg-page)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>
                Bank Payment
              </p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(Math.abs(bankTxn.amount))}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                {formatDate(bankTxn.date)}
              </p>
            </div>

            <ArrowRight size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />

            <div className="flex-1 min-w-0 text-right">
              <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-muted)' }}>
                {matchedCardName || 'Credit Card'}
              </p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {coverage ? formatCurrency(coverage.statementBalance) : '—'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {coverage?.transactionCount || 0} transactions
                {coverage?.closingDate && <> &middot; closed {formatDate(coverage.closingDate)}</>}
              </p>
            </div>
          </div>

          {/* Coverage gap warning */}
          {hasGap && (
            <div
              className="mt-2 text-[11px] px-3 py-1.5 rounded-md"
              style={{
                background: coverage.difference > 0 ? 'rgba(251,146,60,0.1)' : 'rgba(34,197,94,0.1)',
                color: coverage.difference > 0 ? '#fb923c' : '#22c55e',
              }}
            >
              {coverage.difference > 0
                ? `Payment is ${formatCurrency(coverage.difference)} more than net charges — may include interest, fees, or prior balance`
                : `Payment is ${formatCurrency(Math.abs(coverage.difference))} less than net charges — partial payment`}
            </div>
          )}
        </div>

        {/* Category breakdown (collapsible) */}
        {categorySummary.length > 0 && (
          <div className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setShowCategories(p => !p)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>Category Breakdown</span>
              {showCategories ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showCategories && (
              <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1">
                {categorySummary.map(({ category, total, count }) => {
                  const cat = findCategory(category)
                  return (
                    <button
                      key={category}
                      onClick={() => setFilterCategory(prev => prev === category ? '' : category)}
                      className="flex items-center gap-1.5 py-0.5 rounded transition-colors text-left"
                      style={{
                        opacity: filterCategory && filterCategory !== category ? 0.4 : 1,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: cat?.color || '#6b7280' }}
                      />
                      <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                        {cat?.label || category}
                      </span>
                      <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(total)}
                        <span className="ml-0.5 opacity-60">({count})</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Search / filter bar */}
        <div className="px-4 pt-3 pb-2 flex gap-2 items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search transactions..."
            className="flex-1 text-sm px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
          {filterCategory && (
            <button
              onClick={() => setFilterCategory('')}
              className="text-[11px] px-2 py-1 rounded-md"
              style={{ color: 'var(--accent-blue)', background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' }}
            >
              Clear filter
            </button>
          )}
          <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
              {transactions.length === 0
                ? 'Statement transactions not yet loaded'
                : 'No transactions match your filter'}
            </p>
          ) : (
            filtered.map((txn, i) => {
              const cat = findCategory(txn.category)
              const isRefund = (txn.amount || 0) < 0
              return (
                <div
                  key={txn.id || i}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md"
                  style={{
                    background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle, rgba(255,255,255,0.02))',
                  }}
                >
                  {/* Category dot */}
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: cat?.color || '#6b7280' }}
                  />

                  {/* Merchant + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                      {txn.merchantName || txn.description || '—'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(txn.date)}
                      {cat && <> &middot; {cat.label}</>}
                    </p>
                  </div>

                  {/* Amount */}
                  <span
                    className="text-xs font-medium tabular-nums whitespace-nowrap"
                    style={{ color: isRefund ? 'var(--accent-emerald)' : 'var(--text-primary)' }}
                  >
                    {isRefund ? '-' : ''}{formatCurrency(Math.abs(txn.amount))}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer summary */}
        {coverage && (
          <div
            className="px-4 py-3 border-t flex items-center justify-between text-xs"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle, var(--bg-card))' }}
          >
            <div style={{ color: 'var(--text-muted)' }}>
              {coverage.chargeTotal > 0 && <span>Charges: {formatCurrency(coverage.chargeTotal)}</span>}
              {coverage.refundTotal > 0 && <span className="ml-3">Refunds: -{formatCurrency(coverage.refundTotal)}</span>}
            </div>
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Net: {formatCurrency(coverage.netTotal)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
