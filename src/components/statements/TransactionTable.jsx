import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Link2, CreditCard, ArrowLeftRight } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { STATEMENT_CATEGORIES, findCategory } from '../../constants/categories'
import { isCCPaymentTransaction } from '../../utils/ccPaymentDetector'
import { isInternalTransfer } from '../../utils/transferDetector'

// Determine payment method label + color from transaction metadata
function getPaymentMethod(txn) {
  const desc = (txn.description || txn.merchantName || '').toUpperCase()
  const isAchLike =
    txn.paymentChannel === 'other' ||
    /\b(ACH|WIRE|ZELLE|VENMO|PAYPAL|TRANSFER|DIRECT DEP)\b/.test(desc)

  if (isAchLike) return { label: 'ACH', color: '#8b5cf6' }
  if (txn.accountType === 'depository') return { label: 'Bank', color: '#06b6d4' }
  return null // credit card — show last 4 only
}

export default function TransactionTable({ transactions = [], txnToOverviewMap, onOpenLinkModal, onOpenCCPicklist }) {
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAccount, setFilterAccount] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const hasLinking = !!onOpenLinkModal

  // Build unique account list for the account filter
  const uniqueAccounts = useMemo(() => {
    const seen = new Map()
    for (const txn of transactions) {
      if (!txn.accountName) continue
      const key = txn.accountName
      if (!seen.has(key)) {
        seen.set(key, {
          name: txn.accountName,
          lastFour: txn.cardLastFour,
        })
      }
    }
    return [...seen.values()]
  }, [transactions])

  const sorted = useMemo(() => {
    const min = minAmount !== '' ? parseFloat(minAmount) : null
    const max = maxAmount !== '' ? parseFloat(maxAmount) : null

    let filtered = transactions
    if (filterCategory) {
      filtered = filtered.filter(t => t.category === filterCategory)
    }
    if (filterAccount) {
      filtered = filtered.filter(t => t.accountName === filterAccount)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(t =>
        (t.merchantName || '').toLowerCase().includes(term) ||
        (t.description || '').toLowerCase().includes(term)
      )
    }
    if (min !== null) {
      filtered = filtered.filter(t => Math.abs(t.amount) >= min)
    }
    if (max !== null) {
      filtered = filtered.filter(t => Math.abs(t.amount) <= max)
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = (a.date || '').localeCompare(b.date || '')
      else if (sortField === 'amount') cmp = (a.amount || 0) - (b.amount || 0)
      else if (sortField === 'merchant') cmp = (a.merchantName || '').localeCompare(b.merchantName || '')
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [transactions, sortField, sortDir, filterCategory, filterAccount, searchTerm, minAmount, maxAmount])

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={12} strokeWidth={1.75} style={{ color: 'var(--text-faint)', display: 'inline', verticalAlign: 'middle' }} />
    return sortDir === 'asc'
      ? <ArrowUp size={12} strokeWidth={2} style={{ color: 'var(--accent-blue)', display: 'inline', verticalAlign: 'middle' }} />
      : <ArrowDown size={12} strokeWidth={2} style={{ color: 'var(--accent-blue)', display: 'inline', verticalAlign: 'middle' }} />
  }

  const usedCategories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category).filter(Boolean))
    const result = []
    for (const c of STATEMENT_CATEGORIES) {
      if (cats.has(c.key)) result.push(c)
      if (c.subCategories) {
        for (const sub of c.subCategories) {
          if (cats.has(sub.key)) result.push(sub)
        }
      }
    }
    return result
  }, [transactions])

  const hasActiveFilters = filterCategory || filterAccount || searchTerm || minAmount || maxAmount

  function clearFilters() {
    setFilterCategory('')
    setFilterAccount('')
    setSearchTerm('')
    setMinAmount('')
    setMaxAmount('')
  }

  if (transactions.length === 0) {
    return (
      <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        No transactions yet. Statements will appear here once emails are processed.
      </div>
    )
  }

  const inputStyle = {
    background: 'var(--bg-page)',
    border: '1px solid var(--border-input)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="space-y-3">
      {/* Filter rows */}
      <div className="space-y-2">
        {/* Row 1: search + category + account */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search merchants..."
            className="text-sm px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60"
            style={{ ...inputStyle, minWidth: 160 }}
          />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg outline-none"
            style={inputStyle}
          >
            <option value="">All Categories</option>
            {usedCategories.map(cat => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
          {uniqueAccounts.length > 1 && (
            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg outline-none"
              style={inputStyle}
            >
              <option value="">All Accounts</option>
              {uniqueAccounts.map(acc => (
                <option key={acc.name} value={acc.name}>
                  {acc.lastFour ? `${acc.name} ••••${acc.lastFour}` : acc.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Row 2: amount range + count + clear */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Amount:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>$</span>
            <input
              type="number"
              value={minAmount}
              onChange={e => setMinAmount(e.target.value)}
              placeholder="Min"
              min="0"
              className="text-sm px-2 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60 w-20"
              style={inputStyle}
            />
          </div>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>–</span>
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>$</span>
            <input
              type="number"
              value={maxAmount}
              onChange={e => setMaxAmount(e.target.value)}
              placeholder="Max"
              min="0"
              className="text-sm px-2 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60 w-20"
              style={inputStyle}
            />
          </div>
          <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
            {sorted.length} transaction{sorted.length !== 1 ? 's' : ''}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs px-2 py-1 rounded-lg ml-auto"
              style={{ color: 'var(--accent-blue)', background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-subtle, var(--bg-card))', borderBottom: '1px solid var(--border-subtle)' }}>
              <th
                className="text-left px-3 py-2 cursor-pointer select-none"
                style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                onClick={() => toggleSort('date')}
              >
                Date <SortIcon field="date" />
              </th>
              <th
                className="text-left px-3 py-2 cursor-pointer select-none"
                style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                onClick={() => toggleSort('merchant')}
              >
                Merchant <SortIcon field="merchant" />
              </th>
              <th
                className="text-left px-3 py-2"
                style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Category
              </th>
              <th
                className="text-left px-3 py-2"
                style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Payment
              </th>
              <th
                className="text-right px-3 py-2 cursor-pointer select-none"
                style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                onClick={() => toggleSort('amount')}
              >
                Amount <SortIcon field="amount" />
              </th>
              {hasLinking && (
                <th
                  className="px-2 py-2 text-center"
                  style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: 40 }}
                >
                  <Link2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 100).map((txn, i) => {
              const cat = findCategory(txn.category)
              const linkedKey = hasLinking && txnToOverviewMap ? txnToOverviewMap[txn.id] : null
              const payMethod = getPaymentMethod(txn)
              return (
                <tr
                  key={txn.id || i}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle, rgba(255,255,255,0.02))',
                  }}
                >
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    {txn.date ? new Date(txn.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }}>
                    {txn.merchantName || txn.description || '—'}
                    {txn.pending && (
                      <span className="ml-1 text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
                        pending
                      </span>
                    )}
                    {isCCPaymentTransaction(txn) && (
                      onOpenCCPicklist ? (
                        <button
                          onClick={e => { e.stopPropagation(); onOpenCCPicklist(txn) }}
                          className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full transition-colors cursor-pointer"
                          style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c' }}
                          title="View statement breakdown for this CC payment"
                        >
                          <CreditCard size={9} strokeWidth={2} />
                          CC Pmt
                        </button>
                      ) : (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c' }}
                          title="Credit card payment detected"
                        >
                          <CreditCard size={9} strokeWidth={2} />
                          CC Pmt
                        </span>
                      )
                    )}
                    {isInternalTransfer(txn) && !isCCPaymentTransaction(txn) && (
                      <span
                        className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}
                        title="Internal transfer between your own accounts"
                      >
                        <ArrowLeftRight size={9} strokeWidth={2} />
                        Transfer
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {cat && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: cat.color + '20', color: cat.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                        {cat.label}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {/* ACH / Bank badge */}
                      {payMethod ? (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: payMethod.color + '20', color: payMethod.color }}
                        >
                          {payMethod.label}
                        </span>
                      ) : null}
                      {/* Card last four */}
                      {txn.cardLastFour ? (
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          ••••{txn.cardLastFour}
                        </span>
                      ) : !payMethod ? (
                        <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>—</span>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap"
                    style={{ color: txn.amount < 0 ? 'var(--accent-emerald)' : 'var(--text-primary)' }}
                  >
                    {txn.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(txn.amount))}
                  </td>
                  {hasLinking && (
                    <td className="px-2 py-2 text-center" style={{ width: 40 }}>
                      <button
                        onClick={() => onOpenLinkModal(txn)}
                        title={linkedKey ? 'Linked — click to manage' : 'Link to overview item'}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors"
                        style={{
                          color: linkedKey ? 'var(--accent-blue)' : 'var(--text-muted)',
                          background: linkedKey ? 'color-mix(in srgb, var(--accent-blue) 12%, transparent)' : 'transparent',
                        }}
                      >
                        <Link2 size={13} strokeWidth={linkedKey ? 2.2 : 1.5} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {sorted.length > 100 && (
          <div className="text-center py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Showing first 100 of {sorted.length} transactions
          </div>
        )}
        {sorted.length === 0 && transactions.length > 0 && (
          <div className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            No transactions match your filters
          </div>
        )}
      </div>
    </div>
  )
}
