import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Link2, CreditCard } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { STATEMENT_CATEGORIES } from '../../constants/categories'
import { isCCPaymentTransaction } from '../../utils/ccPaymentDetector'

export default function TransactionTable({ transactions = [], txnToOverviewMap, onOpenLinkModal }) {
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [filterCategory, setFilterCategory] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const hasLinking = !!onOpenLinkModal

  const sorted = useMemo(() => {
    let filtered = transactions
    if (filterCategory) {
      filtered = filtered.filter(t => t.category === filterCategory)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(t =>
        (t.merchantName || '').toLowerCase().includes(term) ||
        (t.description || '').toLowerCase().includes(term)
      )
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = (a.date || '').localeCompare(b.date || '')
      else if (sortField === 'amount') cmp = (a.amount || 0) - (b.amount || 0)
      else if (sortField === 'merchant') cmp = (a.merchantName || '').localeCompare(b.merchantName || '')
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [transactions, sortField, sortDir, filterCategory, searchTerm])

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
    return STATEMENT_CATEGORIES.filter(c => cats.has(c.key))
  }, [transactions])

  if (transactions.length === 0) {
    return (
      <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        No transactions yet. Statements will appear here once emails are processed.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search merchants..."
          className="text-sm px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60"
          style={{
            background: 'var(--bg-page)',
            border: '1px solid var(--border-input)',
            color: 'var(--text-primary)',
            minWidth: 160,
          }}
        />
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg outline-none"
          style={{
            background: 'var(--bg-page)',
            border: '1px solid var(--border-input)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Categories</option>
          {usedCategories.map(cat => (
            <option key={cat.key} value={cat.key}>{cat.label}</option>
          ))}
        </select>
        <span className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>
          {sorted.length} transaction{sorted.length !== 1 ? 's' : ''}
        </span>
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
              const cat = STATEMENT_CATEGORIES.find(c => c.key === txn.category)
              const linkedKey = hasLinking && txnToOverviewMap ? txnToOverviewMap[txn.id] : null
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
                      <span
                        className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c' }}
                        title="Credit card payment detected"
                      >
                        <CreditCard size={9} strokeWidth={2} />
                        CC Pmt
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
      </div>
    </div>
  )
}
