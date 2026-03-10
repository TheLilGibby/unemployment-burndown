import { useState, useMemo, useEffect } from 'react'
import { X, Link2, Unlink } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { findMatchingTransactions } from '../../utils/transactionMatcher'

const TYPE_CONFIG = {
  otp: { label: 'Purchase', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  ote: { label: 'Expense',  color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  oti: { label: 'Income',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TransactionLinkModal({
  open,
  transaction,
  oneTimePurchases = [],
  oneTimeExpenses = [],
  oneTimeIncome = [],
  transactionLinks = {},
  txnToOverviewMap = {},
  onLink,
  onUnlink,
  onClose,
}) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open) { setSearch('') }
  }, [open])

  // Build all overview items with type prefixes
  const allItems = useMemo(() => [
    ...oneTimePurchases.map(p => ({ ...p, _type: 'otp', _key: `otp_${p.id}` })),
    ...oneTimeExpenses.map(e => ({ ...e, _type: 'ote', _key: `ote_${e.id}` })),
    ...oneTimeIncome.map(i => ({ ...i, _type: 'oti', _key: `oti_${i.id}` })),
  ], [oneTimePurchases, oneTimeExpenses, oneTimeIncome])

  // Find auto-suggested matches
  const rankedItems = useMemo(() => {
    if (!transaction) return allItems
    const txnAsItem = { amount: transaction.amount, date: transaction.date }
    // Use matcher in reverse — find overview items that match the transaction
    const scored = allItems.map(item => {
      const amountDiff = Math.abs(Math.abs(Number(item.amount) || 0) - Math.abs(transaction.amount || 0))
      const itemDate = new Date(item.date + 'T00:00:00')
      const txnDate = new Date(transaction.date + 'T00:00:00')
      const dayDiff = Math.abs(Math.round((itemDate - txnDate) / (1000 * 60 * 60 * 24)))
      const itemAmount = Math.abs(Number(item.amount) || 0)
      const score = (amountDiff / (itemAmount || 1)) * 100 + dayDiff
      const isMatch = amountDiff / (itemAmount || 1) <= 0.15 && dayDiff <= 14
      return { ...item, _matchScore: score, _dayDiff: dayDiff, _amountDiff: amountDiff, _isMatch: isMatch }
    })
    return scored.sort((a, b) => a._matchScore - b._matchScore)
  }, [allItems, transaction])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search) return rankedItems
    const term = search.toLowerCase()
    return rankedItems.filter(item =>
      (item.description || '').toLowerCase().includes(term)
    )
  }, [rankedItems, search])

  // Check if this transaction is already linked
  const existingLink = transaction ? txnToOverviewMap[transaction.id] : null
  const existingItem = existingLink ? allItems.find(i => i._key === existingLink) : null

  if (!open || !transaction) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        role="dialog" aria-modal="true" className="relative rounded-xl border shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Link Transaction
            </h3>
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatDate(transaction.date)} &middot; {transaction.merchantName || transaction.description || '—'}
              </p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(Math.abs(transaction.amount))}
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

        {/* Already linked */}
        {existingItem && (
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)', background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)' }}>
            <Link2 size={14} style={{ color: 'var(--accent-blue)' }} />
            <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>
              Linked to: <strong>{existingItem.description}</strong>
            </span>
            <button
              onClick={() => onUnlink(existingLink, transaction.id)}
              className="text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1"
              style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <Unlink size={11} /> Unlink
            </button>
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search overview items..."
            className="w-full text-sm px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
              No overview items found
            </p>
          ) : (
            filtered.map(item => {
              const cfg = TYPE_CONFIG[item._type]
              const isLinkedToThis = existingLink === item._key
              const itemHasLinks = (transactionLinks[item._key] || []).length > 0
              return (
                <div
                  key={item._key}
                  className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                  style={{
                    background: isLinkedToThis ? 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' : 'transparent',
                    border: item._isMatch && !isLinkedToThis ? '1px solid color-mix(in srgb, var(--accent-blue) 20%, transparent)' : '1px solid transparent',
                  }}
                >
                  {/* Type badge */}
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {cfg.label}
                  </span>

                  {/* Description + details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.description || '—'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(item.date)} &middot; {formatCurrency(Math.abs(Number(item.amount) || 0))}
                      {item._isMatch && (
                        <span style={{ color: 'var(--accent-blue)' }}>
                          {' '}&middot; {item._dayDiff === 0 ? 'same day' : `${item._dayDiff}d off`}
                          {item._amountDiff === 0 ? ', exact $' : `, ${formatCurrency(item._amountDiff)} diff`}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Link/linked button */}
                  {isLinkedToThis ? (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-md" style={{ color: 'var(--accent-blue)' }}>
                      Linked
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        if (!existingLink) {
                          onLink(item._key, transaction)
                        }
                      }}
                      disabled={!!existingLink}
                      className="text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                      style={{
                        color: existingLink ? 'var(--text-muted)' : 'var(--accent-blue)',
                        border: `1px solid ${existingLink ? 'var(--border-subtle)' : 'color-mix(in srgb, var(--accent-blue) 40%, transparent)'}`,
                        cursor: existingLink ? 'not-allowed' : 'pointer',
                        opacity: existingLink ? 0.5 : 1,
                      }}
                    >
                      <Link2 size={11} /> Link
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
