import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Link2, CreditCard, ArrowLeftRight, Briefcase, Tag, Filter, X, ChevronRight } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { STATEMENT_CATEGORIES, findCategory, resolveCategory, getParentCategoryKey } from '../../constants/categories'
import { useToast } from '../../context/ToastContext'
import { isCCPayment } from '../../utils/ccPaymentDetector'
import { isInternalTransfer } from '../../utils/transferDetector'

const FILTER_CATEGORIES_KEY = 'burndown_txn_filter_categories'

function loadFilterCategories() {
  try {
    const raw = localStorage.getItem(FILTER_CATEGORIES_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveFilterCategories(filterSet) {
  try {
    if (filterSet.size > 0) localStorage.setItem(FILTER_CATEGORIES_KEY, JSON.stringify([...filterSet]))
    else localStorage.removeItem(FILTER_CATEGORIES_KEY)
  } catch { /* ignore */ }
}

// Determine payment method label + color from transaction metadata
function getPaymentMethod(txn) {
  const desc = (txn.description || txn.merchantName || '').toUpperCase()
  const isAchLike =
    txn.paymentChannel === 'other' ||
    /\b(ACH|WIRE|ZELLE|VENMO|PAYPAL|TRANSFER|DIRECT DEP)\b/.test(desc)

  if (isAchLike) return { label: 'ACH', color: '#8b5cf6' }
  if (txn.accountType === 'depository') return { label: 'Bank', color: '#06b6d4' }
  return { label: 'CC', color: '#f97316' }
}

export default function TransactionTable({
  transactions = [], txnToOverviewMap, onOpenLinkModal, onOpenCCPicklist,
  jobs = [], transactionOverrides = {}, onTransactionOverride,
  pairLookup,
}) {
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [filterCategories, setFilterCategoriesRaw] = useState(loadFilterCategories)
  const setFilterCategories = useCallback((updater) => {
    setFilterCategoriesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveFilterCategories(next)
      return next
    })
  }, [])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [expandedFilterParent, setExpandedFilterParent] = useState(null)
  const filterDropdownRef = useRef(null)
  const [filterAccount, setFilterAccount] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [payrollDropdownTxnId, setPayrollDropdownTxnId] = useState(null)
  const payrollDropdownRef = useRef(null)
  const [categoryDropdownTxnId, setCategoryDropdownTxnId] = useState(null)
  const categoryDropdownRef = useRef(null)

  const { addToast } = useToast()

  const hasLinking = !!onOpenLinkModal
  const hasPayrollTagging = !!onTransactionOverride && jobs.length > 0

  function handleCategoryChange(txn, newCategoryKey) {
    const oldCategory = txn.category || 'other_general'
    onTransactionOverride(txn.id, { category: newCategoryKey }, txn.statementId)
    setCategoryDropdownTxnId(null)
    const newCfg = findCategory(newCategoryKey)
    addToast({
      title: 'Category changed',
      message: `${(txn.merchantName || txn.description || 'Transaction').slice(0, 25)} \u2192 ${newCfg?.label || newCategoryKey}`,
      severity: 'info',
      ttl: 6000,
      action: {
        label: 'Undo',
        onClick: () => onTransactionOverride(txn.id, { category: oldCategory }, txn.statementId),
      },
    })
  }

  // Close payroll dropdown on outside click
  useEffect(() => {
    if (!payrollDropdownTxnId) return
    function handleClick(e) {
      if (payrollDropdownRef.current && !payrollDropdownRef.current.contains(e.target)) {
        setPayrollDropdownTxnId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [payrollDropdownTxnId])

  // Close category dropdown on outside click
  useEffect(() => {
    if (!categoryDropdownTxnId) return
    function handleClick(e) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setCategoryDropdownTxnId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [categoryDropdownTxnId])

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!showFilterDropdown) return
    function handleClick(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setShowFilterDropdown(false)
        setExpandedFilterParent(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFilterDropdown])

  function toggleFilterCategory(key) {
    setFilterCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function removeFilterCategory(key) {
    setFilterCategories(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

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
    if (filterCategories.size > 0) {
      filtered = filtered.filter(t => {
        const resolved = resolveCategory(t.category || 'other_general')
        const parentKey = getParentCategoryKey(resolved)
        // Match if any filter key matches: either a parent key (matches all its subs) or a specific sub key
        for (const fk of filterCategories) {
          if (fk === parentKey) return true
          if (fk === resolved) return true
        }
        return false
      })
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
  }, [transactions, sortField, sortDir, filterCategories, filterAccount, searchTerm, minAmount, maxAmount])

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

  const hasActiveFilters = filterCategories.size > 0 || filterAccount || searchTerm || minAmount || maxAmount

  function clearFilters() {
    setFilterCategories(new Set())
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
          {/* Category filter pill */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => { setShowFilterDropdown(v => !v); setExpandedFilterParent(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-150"
              style={{
                background: filterCategories.size > 0 ? 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' : 'var(--bg-subtle, rgba(255,255,255,0.06))',
                color: filterCategories.size > 0 ? 'var(--accent-blue)' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: filterCategories.size > 0 ? 'color-mix(in srgb, var(--accent-blue) 40%, transparent)' : 'var(--border-subtle)',
              }}
            >
              <Filter size={13} />
              Categories
              {filterCategories.size > 0 && (
                <span
                  className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--accent-blue)', color: '#fff', minWidth: 18, height: 18, padding: '0 4px' }}
                >
                  {filterCategories.size}
                </span>
              )}
            </button>

            {showFilterDropdown && (
              <div
                className="absolute z-30 mt-1.5 rounded-xl shadow-2xl py-2 overflow-y-auto"
                style={{
                  background: 'var(--bg-card, #111827)',
                  border: '1px solid var(--border-default)',
                  minWidth: 240,
                  maxHeight: 380,
                  left: 0,
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pb-1.5 mb-1" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  Filter by category
                </p>
                {STATEMENT_CATEGORIES.map(c => {
                  const isParentActive = filterCategories.has(c.key)
                  const hasActiveSubs = c.subCategories.some(s => filterCategories.has(s.key))
                  const isExpanded = expandedFilterParent === c.key
                  const hasMultipleSubs = c.subCategories.length > 1
                  return (
                    <div key={c.key}>
                      <div className="flex items-center">
                        <button
                          onClick={() => toggleFilterCategory(c.key)}
                          className="flex-1 flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors duration-100 hover:bg-white/5"
                          style={{
                            color: isParentActive ? c.color : 'var(--text-primary)',
                            background: isParentActive ? c.color + '18' : 'transparent',
                          }}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center transition-all duration-100"
                            style={{
                              border: '1.5px solid',
                              borderColor: isParentActive ? c.color : 'var(--border-subtle)',
                              background: isParentActive ? c.color + '30' : 'transparent',
                            }}
                          >
                            {isParentActive && (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <span className="font-medium truncate">{c.label}</span>
                        </button>
                        {hasMultipleSubs && (
                          <button
                            onClick={() => setExpandedFilterParent(isExpanded ? null : c.key)}
                            className="px-2 py-1.5 transition-colors hover:bg-white/5"
                            style={{ color: 'var(--text-muted)' }}
                            title="Show subcategories"
                          >
                            <ChevronRight
                              size={12}
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
                            />
                          </button>
                        )}
                      </div>
                      {isExpanded && c.subCategories.filter(s => s.key !== c.key + '_general').map(sub => {
                        const isSubActive = filterCategories.has(sub.key)
                        return (
                          <button
                            key={sub.key}
                            onClick={() => toggleFilterCategory(sub.key)}
                            className="w-full flex items-center gap-2 pl-9 pr-3 py-1 text-left text-[11px] transition-colors duration-100 hover:bg-white/5"
                            style={{
                              color: isSubActive ? sub.color : 'var(--text-secondary)',
                              background: isSubActive ? sub.color + '18' : 'transparent',
                            }}
                          >
                            <span
                              className="w-3 h-3 rounded flex-shrink-0 flex items-center justify-center transition-all duration-100"
                              style={{
                                border: '1.5px solid',
                                borderColor: isSubActive ? sub.color : 'var(--border-subtle)',
                                background: isSubActive ? sub.color + '30' : 'transparent',
                              }}
                            >
                              {isSubActive && (
                                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sub.color }} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
                {filterCategories.size > 0 && (
                  <div className="px-3 pt-2 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      onClick={() => setFilterCategories(new Set())}
                      className="text-[10px] font-medium px-2 py-1 rounded-full transition-colors"
                      style={{ color: 'var(--accent-blue)', background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' }}
                    >
                      Clear category filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
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

        {/* Active category filter pills */}
        {filterCategories.size > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[...filterCategories].map(key => {
              // Check if it's a parent key or sub key
              const parentCfg = STATEMENT_CATEGORIES.find(c => c.key === key)
              if (parentCfg) {
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium transition-all duration-150"
                    style={{
                      background: parentCfg.color + '15',
                      border: '1px solid ' + parentCfg.color + '30',
                      color: parentCfg.color,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: parentCfg.color }} />
                    {parentCfg.label}
                    <button
                      onClick={() => removeFilterCategory(key)}
                      className="ml-0.5 p-0.5 rounded-full transition-colors hover:bg-white/10"
                      style={{ color: parentCfg.color }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                )
              }
              const subCfg = findCategory(key)
              if (subCfg) {
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium transition-all duration-150"
                    style={{
                      background: subCfg.color + '15',
                      border: '1px solid ' + subCfg.color + '30',
                      color: subCfg.color,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: subCfg.color }} />
                    {subCfg.label}
                    <button
                      onClick={() => removeFilterCategory(key)}
                      className="ml-0.5 p-0.5 rounded-full transition-colors hover:bg-white/10"
                      style={{ color: subCfg.color }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                )
              }
              return null
            })}
          </div>
        )}

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
              {hasPayrollTagging && (
                <th
                  className="px-2 py-2 text-center"
                  style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: 70 }}
                >
                  Payroll
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
                    {isCCPayment(txn) && (
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
                    {isInternalTransfer(txn) && !isCCPayment(txn) && (() => {
                      const pairInfo = pairLookup?.get(txn.id)
                      return pairInfo ? (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' }}
                          title={`Paired transfer with ${pairInfo.counterpart.accountName || 'another account'} (${pairInfo.counterpart.date})`}
                        >
                          <ArrowLeftRight size={9} strokeWidth={2} />
                          Paired
                        </span>
                      ) : (
                        <span
                          className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}
                          title="Internal transfer between your own accounts"
                        >
                          <ArrowLeftRight size={9} strokeWidth={2} />
                          Transfer
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2 relative">
                    {onTransactionOverride ? (
                      <>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setPayrollDropdownTxnId(null)
                            setCategoryDropdownTxnId(categoryDropdownTxnId === txn.id ? null : txn.id)
                          }}
                          className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full cursor-pointer transition-opacity hover:opacity-80"
                          style={cat
                            ? { background: cat.color + '20', color: cat.color }
                            : { background: 'rgba(107,114,128,0.15)', color: 'var(--text-muted)' }
                          }
                          title="Change category"
                        >
                          {cat ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                              {cat.label}
                            </>
                          ) : (
                            <>
                              <Tag size={10} strokeWidth={1.5} />
                              <span>Uncategorized</span>
                            </>
                          )}
                        </button>
                        {categoryDropdownTxnId === txn.id && (
                          <div
                            ref={categoryDropdownRef}
                            className="absolute left-0 top-full z-50 mt-1 rounded-lg shadow-lg py-1 min-w-[200px] max-h-[320px] overflow-y-auto"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                          >
                            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                              Select category
                            </div>
                            {STATEMENT_CATEGORIES.map(c => {
                              const resolvedTxnCat = resolveCategory(txn.category || 'other_general')
                              const txnParent = getParentCategoryKey(resolvedTxnCat)
                              const isParentSelected = txnParent === c.key
                              const generalKey = c.key + '_general'
                              // Find the _general sub to check if parent itself is "selected"
                              const isGeneralSelected = resolvedTxnCat === generalKey
                              return (
                                <div key={c.key}>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      handleCategoryChange(txn, generalKey)
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2"
                                    style={{
                                      color: isGeneralSelected ? c.color : 'var(--text-primary)',
                                      background: isGeneralSelected ? c.color + '18' : 'transparent',
                                    }}
                                    onMouseEnter={e => { if (!isGeneralSelected) e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = isGeneralSelected ? c.color + '18' : 'transparent' }}
                                  >
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                                    <span className="truncate">{c.label}</span>
                                  </button>
                                  {isParentSelected && c.subCategories.filter(s => s.key !== generalKey).map(sub => {
                                    const isSubSel = resolvedTxnCat === sub.key
                                    return (
                                      <button
                                        key={sub.key}
                                        onClick={e => {
                                          e.stopPropagation()
                                          handleCategoryChange(txn, sub.key)
                                        }}
                                        className="w-full text-left pl-7 pr-3 py-1 text-[11px] transition-colors flex items-center gap-2"
                                        style={{
                                          color: isSubSel ? sub.color : 'var(--text-secondary)',
                                          background: isSubSel ? sub.color + '18' : 'transparent',
                                        }}
                                        onMouseEnter={e => { if (!isSubSel) e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = isSubSel ? sub.color + '18' : 'transparent' }}
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sub.color }} />
                                        <span className="truncate">{sub.label}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      cat && (
                        <span
                          className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: cat.color + '20', color: cat.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                          {cat.label}
                        </span>
                      )
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
                  {hasPayrollTagging && (() => {
                    const override = transactionOverrides[txn.id] || {}
                    const isPayroll = override.isPayroll
                    const taggedJob = isPayroll && override.payrollJobId
                      ? jobs.find(j => (j.jobId || j.id) === override.payrollJobId)
                      : null
                    const isDropdownOpen = payrollDropdownTxnId === txn.id
                    return (
                      <td className="px-2 py-2 text-center relative" style={{ width: 70 }}>
                        {isPayroll ? (
                          <button
                            onClick={e => { e.stopPropagation(); setCategoryDropdownTxnId(null); setPayrollDropdownTxnId(isDropdownOpen ? null : txn.id) }}
                            className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full transition-colors cursor-pointer"
                            style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
                            title={taggedJob ? `Payroll: ${taggedJob.title || taggedJob.employer}` : 'Payroll tagged'}
                          >
                            <Briefcase size={9} strokeWidth={2} />
                            {taggedJob ? (taggedJob.title || taggedJob.employer).slice(0, 8) : 'Payroll'}
                          </button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setCategoryDropdownTxnId(null); setPayrollDropdownTxnId(isDropdownOpen ? null : txn.id) }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors"
                            style={{ color: 'var(--text-muted)', background: 'transparent' }}
                            title="Tag as payroll"
                          >
                            <Briefcase size={13} strokeWidth={1.5} />
                          </button>
                        )}
                        {isDropdownOpen && (
                          <div
                            ref={payrollDropdownRef}
                            className="absolute right-0 top-full z-50 mt-1 rounded-lg shadow-lg py-1 min-w-[180px]"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                          >
                            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                              Tag as payroll
                            </div>
                            {jobs.map(job => {
                              const jid = job.jobId || job.id
                              const isSelected = isPayroll && override.payrollJobId === jid
                              return (
                                <button
                                  key={jid}
                                  onClick={e => {
                                    e.stopPropagation()
                                    onTransactionOverride(txn.id, { isPayroll: true, payrollJobId: jid }, txn.statementId)
                                    setPayrollDropdownTxnId(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2"
                                  style={{
                                    color: isSelected ? 'var(--accent-emerald)' : 'var(--text-primary)',
                                    background: isSelected ? 'color-mix(in srgb, var(--accent-emerald) 10%, transparent)' : 'transparent',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))'}
                                  onMouseLeave={e => e.currentTarget.style.background = isSelected ? 'color-mix(in srgb, var(--accent-emerald) 10%, transparent)' : 'transparent'}
                                >
                                  <Briefcase size={11} strokeWidth={1.5} />
                                  <span className="truncate">{job.title || job.employer || 'Untitled'}</span>
                                  {job.employer && job.title && (
                                    <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>{job.employer}</span>
                                  )}
                                </button>
                              )
                            })}
                            {isPayroll && (
                              <>
                                <div className="mx-2 my-1" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    onTransactionOverride(txn.id, { isPayroll: false, payrollJobId: null }, txn.statementId)
                                    setPayrollDropdownTxnId(null)
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                                  style={{ color: 'var(--accent-red, #ef4444)' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  Remove payroll tag
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })()}
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
