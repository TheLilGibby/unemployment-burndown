import { useState, useMemo } from 'react'
import { X, Link2, Unlink, Search } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { findMatchingTransactions } from '../../utils/transactionMatcher'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TransactionLookupModal({
  open,
  overviewKey,
  overviewItem,
  allTransactions = [],
  linkedTransactions = [],
  txnToOverviewMap = {},
  onLink,
  onUnlink,
  onClose,
}) {
  const [search, setSearch] = useState('')
  const [dayRange, setDayRange] = useState(7)
  const [amountPct, setAmountPct] = useState(10)

  // Auto-matched transactions
  const matches = useMemo(() => {
    if (!overviewItem || !allTransactions.length) return []
    return findMatchingTransactions(overviewItem, allTransactions, { dayRange, amountTolerancePct: amountPct })
  }, [overviewItem, allTransactions, dayRange, amountPct])

  // Manual search across all transactions
  const searchResults = useMemo(() => {
    if (!search) return []
    const term = search.toLowerCase()
    return allTransactions
      .filter(t =>
        (t.merchantName || '').toLowerCase().includes(term) ||
        (t.description || '').toLowerCase().includes(term)
      )
      .slice(0, 50)
  }, [allTransactions, search])

  const linkedIds = new Set(linkedTransactions.map(l => l.transactionId))

  if (!open || !overviewItem) return null

  const displayTransactions = search ? searchResults : matches

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md h-full flex flex-col shadow-2xl border-l"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Find Matching Transactions
            </h3>
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {overviewItem.description || '—'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatDate(overviewItem.date)} &middot; {formatCurrency(Math.abs(Number(overviewItem.amount) || 0))}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Currently linked */}
        {linkedTransactions.length > 0 && (
          <div className="px-4 py-2 border-b space-y-1" style={{ borderColor: 'var(--border-subtle)', background: 'color-mix(in srgb, var(--accent-blue) 6%, transparent)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-blue)' }}>
              Linked ({linkedTransactions.length})
            </p>
            {linkedTransactions.map(link => (
              <div key={link.transactionId} className="flex items-center gap-2 py-1">
                <Link2 size={12} style={{ color: 'var(--accent-blue)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                    {link.merchantName || link.description || '—'}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(link.date)} &middot; {formatCurrency(Math.abs(link.amount))}
                  </p>
                </div>
                <button
                  onClick={() => onUnlink(overviewKey, link.transactionId)}
                  className="text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5"
                  style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <Unlink size={10} /> Unlink
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search all transactions..."
              className="flex-1 text-sm px-2 py-1 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60"
              style={{
                background: 'var(--bg-page)',
                border: '1px solid var(--border-input)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          {!search && (
            <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <label className="flex items-center gap-1">
                <span>Days &plusmn;</span>
                <select
                  value={dayRange}
                  onChange={e => setDayRange(Number(e.target.value))}
                  className="px-1 py-0.5 rounded text-[10px]"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                >
                  <option value={3}>3</option>
                  <option value={7}>7</option>
                  <option value={14}>14</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span>Amount &plusmn;</span>
                <select
                  value={amountPct}
                  onChange={e => setAmountPct(Number(e.target.value))}
                  className="px-1 py-0.5 rounded text-[10px]"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                >
                  <option value={0}>Exact</option>
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                  <option value={20}>20%</option>
                  <option value={50}>50%</option>
                </select>
              </label>
              <span className="ml-auto">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {displayTransactions.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No transactions match your search' : 'No matching transactions found. Try widening the filters.'}
            </p>
          ) : (
            displayTransactions.map((txn, i) => {
              const isLinked = linkedIds.has(txn.id)
              const linkedElsewhere = !isLinked && txnToOverviewMap[txn.id] && txnToOverviewMap[txn.id] !== overviewKey
              return (
                <div
                  key={txn.id || i}
                  className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                  style={{
                    background: isLinked ? 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' : 'transparent',
                    opacity: linkedElsewhere ? 0.4 : 1,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {txn.merchantName || txn.description || '—'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(txn.date)} &middot; {formatCurrency(Math.abs(txn.amount))}
                      {txn._isMatch !== undefined && txn._dayDiff !== undefined && (
                        <span style={{ color: 'var(--accent-blue)' }}>
                          {' '}&middot; {txn._dayDiff === 0 ? 'same day' : `${txn._dayDiff}d off`}
                          {txn._amountDiff === 0 ? ', exact $' : `, ${formatCurrency(txn._amountDiff)} diff`}
                        </span>
                      )}
                      {linkedElsewhere && (
                        <span style={{ color: '#f97316' }}> &middot; linked to another item</span>
                      )}
                    </p>
                  </div>

                  {isLinked ? (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-md" style={{ color: 'var(--accent-blue)' }}>
                      Linked
                    </span>
                  ) : linkedElsewhere ? (
                    <span className="text-[10px] px-2 py-1 rounded-md" style={{ color: 'var(--text-muted)' }}>
                      In use
                    </span>
                  ) : (
                    <button
                      onClick={() => onLink(overviewKey, txn)}
                      className="text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1 flex-shrink-0"
                      style={{
                        color: 'var(--accent-blue)',
                        border: '1px solid color-mix(in srgb, var(--accent-blue) 40%, transparent)',
                      }}
                    >
                      <Link2 size={11} /> Link
                    </button>
                  )}
                </div>
              )
            })
          )}
          {!search && displayTransactions.length >= 50 && (
            <p className="text-[10px] text-center py-2" style={{ color: 'var(--text-muted)' }}>
              Showing first 50 matches
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
