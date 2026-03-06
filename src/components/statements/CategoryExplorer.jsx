import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, X, Tag, EyeOff, Eye, Link2, Unlink, Search, ChevronDown, Filter } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import CategoryDonutChart from './CategoryDonutChart'
import TimePeriodSelector, { getDateRange, getPreviousPeriodRange } from './TimePeriodSelector'
import { formatCurrency } from '../../utils/formatters'
import { STATEMENT_CATEGORIES, findCategory, findParentCategory, getParentCategoryKey, resolveCategory, isGeneralCategory } from '../../constants/categories'
import { useToast } from '../../context/ToastContext'
import TransactionLinkModal from '../linking/TransactionLinkModal'
import { PROFILE_COLORS } from '../profile/ProfileBubble'

/* ───────── helpers ───────── */

function TransactionUserBadge({ userId, membersByUserId }) {
  if (!userId) return null
  const member = membersByUserId[userId]
  if (!member) return null
  const color = PROFILE_COLORS[member.profileColor] || PROFILE_COLORS.blue
  const initial = member.email ? member.email[0].toUpperCase() : '?'
  return (
    <span
      title={member.email}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        fontSize: 9,
        fontWeight: 700,
        color,
        background: color + '22',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {member.avatarDataUrl ? (
        <img src={member.avatarDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      ) : initial}
    </span>
  )
}

const RECENT_CATEGORIES_KEY = 'burndown_recent_categories'
const HIDDEN_CATEGORIES_KEY = 'burndown_hidden_categories'
const MAX_RECENT_CATEGORIES = 5

function loadRecentCategoryKeys() {
  try {
    const raw = localStorage.getItem(RECENT_CATEGORIES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentCategoryKey(categoryKey) {
  try {
    const current = loadRecentCategoryKeys()
    const deduped = [categoryKey, ...current.filter(k => k !== categoryKey)]
    const trimmed = deduped.slice(0, MAX_RECENT_CATEGORIES)
    localStorage.setItem(RECENT_CATEGORIES_KEY, JSON.stringify(trimmed))
    return trimmed
  } catch {
    return [categoryKey]
  }
}

function loadHiddenCategories() {
  try {
    const raw = localStorage.getItem(HIDDEN_CATEGORIES_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveHiddenCategories(hiddenSet) {
  try {
    localStorage.setItem(HIDDEN_CATEGORIES_KEY, JSON.stringify([...hiddenSet]))
  } catch { /* ignore */ }
}

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

function TransactionDrawer({ transaction, onClose, onUpdate, linkedItem, linkedKey, onOpenLinkModal, onUnlink, recentCategories = [], membersByUserId = {} }) {
  const resolvedOriginal = resolveCategory(transaction.category || 'other_general')
  const [editCategory, setEditCategory] = useState(resolvedOriginal)
  const [excluded, setExcluded] = useState(!!transaction.excluded)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const hasChanges = editCategory !== (transaction.category || 'other') || excluded !== !!transaction.excluded
  const { addToast } = useToast()

  const handleSave = () => {
    if (!hasChanges) { onClose(); return }
    const oldCategory = transaction.category || 'other_general'
    const categoryChanged = editCategory !== resolvedOriginal
    onUpdate(transaction.id, { category: editCategory, excluded }, transaction.statementId)
    onClose()
    if (categoryChanged) {
      const newCfg = findCategory(editCategory)
      addToast({
        title: 'Category changed',
        message: `${(transaction.merchantName || transaction.description || 'Transaction').slice(0, 25)} \u2192 ${newCfg?.label || editCategory}`,
        severity: 'info',
        ttl: 6000,
        action: {
          label: 'Undo',
          onClick: () => onUpdate(transaction.id, { category: oldCategory }, transaction.statementId),
        },
      })
    }
  }

  const cat = findCategory(editCategory)

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return STATEMENT_CATEGORIES
    const q = categorySearch.toLowerCase()
    return STATEMENT_CATEGORIES.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.subCategories?.some(s => s.label.toLowerCase().includes(q))
    )
  }, [categorySearch])

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
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
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
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'var(--bg-card, #111827)', borderBottom: '1px solid var(--border-subtle)' }}
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {/* Amount */}
          <div className="text-center py-1">
            <p
              className="text-2xl font-bold tabular-nums"
              style={{ color: transaction.amount < 0 ? 'var(--accent-emerald)' : 'var(--text-primary)' }}
            >
              {transaction.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(transaction.amount))}
            </p>
            {excluded && (
              <span className="inline-flex items-center gap-1 text-[10px] mt-0.5 px-2 py-0.5 rounded-full" style={{ background: '#ef444420', color: '#ef4444' }}>
                <EyeOff size={9} /> Excluded
              </span>
            )}
          </div>

          {/* Details — Apple Settings-style inline rows */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.04))' }}>
            <DetailRow label="Merchant" value={transaction.merchantName || '—'} />
            <DetailRow label="Description" value={transaction.description || '—'} mono />
            <DetailRow
              label="Date"
              value={transaction.date
                ? new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : '—'
              }
            />
            {transaction.pending && (
              <DetailRow label="Status" value="Pending" color="#eab308" />
            )}
            {transaction.syncedByUserId && membersByUserId[transaction.syncedByUserId] && (() => {
              const member = membersByUserId[transaction.syncedByUserId]
              const badgeColor = PROFILE_COLORS[member.profileColor] || PROFILE_COLORS.blue
              return (
                <div
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Synced by</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: badgeColor }}>
                    <TransactionUserBadge userId={transaction.syncedByUserId} membersByUserId={membersByUserId} />
                    {member.email}
                  </span>
                </div>
              )
            })()}
          </div>

          {/* Link to overview item */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
              <span className="text-[9px] font-medium uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                <Link2 size={9} /> Linked Item
              </span>
              <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
            </div>
            {linkedItem ? (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-blue) 20%, transparent)' }}
              >
                <Link2 size={12} style={{ color: 'var(--accent-blue)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {linkedItem.description}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {linkedItem.date ? new Date(linkedItem.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} &middot; {formatCurrency(Math.abs(Number(linkedItem.amount) || 0))}
                    {linkedItem.medium ? ` &middot; ${linkedItem.medium}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onUnlink?.(linkedKey, transaction.id)}
                  className="text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1 flex-shrink-0"
                  style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <Unlink size={10} /> Unlink
                </button>
              </div>
            ) : (
              <button
                onClick={() => onOpenLinkModal?.(transaction)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  color: 'var(--accent-blue)',
                  border: '1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--accent-blue) 5%, transparent)',
                }}
              >
                <Link2 size={12} /> Link to Purchase / Expense / Income
              </button>
            )}
          </div>

          {/* Category selector */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
              <span className="text-[9px] font-medium uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--text-faint)' }}>
                <Tag size={9} /> Category
              </span>
              <div className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
            </div>

            {/* Current selection chip */}
            {cat && (
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-2"
                style={{ background: cat.color + '12', border: '1px solid ' + cat.color + '30' }}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                {isGeneralCategory(editCategory) ? (
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{cat.label}</span>
                ) : (
                  <span className="flex flex-col leading-tight">
                    <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{findParentCategory(editCategory)?.label || ''}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{cat.label}</span>
                  </span>
                )}
                {editCategory !== (transaction.category || 'other') && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-blue)', color: '#fff' }}>
                    changed
                  </span>
                )}
              </div>
            )}

            {/* Recently used categories */}
            {recentCategories.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1 px-0.5" style={{ color: 'var(--text-faint)' }}>
                  Recent
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentCategories.map(rc => {
                    const isSelected = editCategory === rc.key
                    return (
                      <button
                        key={rc.key}
                        onClick={() => setEditCategory(rc.key)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-100"
                        style={{
                          background: isSelected ? rc.color + '25' : 'var(--bg-subtle, rgba(255,255,255,0.06))',
                          border: '1px solid',
                          borderColor: isSelected ? rc.color + '60' : 'var(--border-subtle)',
                          color: isSelected ? '#f9fafb' : 'var(--text-muted)',
                        }}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rc.color }} />
                        {rc.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Collapsible all-categories picker */}
            <button
              onClick={() => { setCategoryPickerOpen(!categoryPickerOpen); setCategorySearch('') }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-100"
              style={{
                background: 'var(--bg-subtle, rgba(255,255,255,0.06))',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              <span>All Categories</span>
              <ChevronDown
                size={14}
                style={{
                  transition: 'transform 0.15s ease',
                  transform: categoryPickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {categoryPickerOpen && (
              <div className="mt-1.5 space-y-1.5" style={{ animation: 'fadeIn 0.15s ease-out' }}>
                {/* Search */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'var(--bg-subtle, rgba(255,255,255,0.06))', border: '1px solid var(--border-subtle)' }}
                >
                  <Search size={12} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    placeholder="Search categories..."
                    className="flex-1 bg-transparent text-xs outline-none"
                    style={{ color: 'var(--text-primary)' }}
                    autoFocus
                  />
                </div>

                {/* 2-column grid */}
                <div className="grid grid-cols-2 gap-1">
                  {filteredCategories.map(c => {
                    const isSelected = editCategory === c.key
                    const isSubSelected = c.subCategories?.some(s => s.key === editCategory)
                    return (
                      <div key={c.key} className={c.subCategories && (isSelected || isSubSelected) ? 'col-span-2' : ''}>
                        <button
                          onClick={() => { setEditCategory(c.key); if (!c.subCategories) setCategoryPickerOpen(false) }}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-xs transition-all duration-100"
                          style={{
                            background: isSelected ? c.color + '18' : 'transparent',
                            border: '1px solid',
                            borderColor: isSelected ? c.color + '60' : 'transparent',
                            color: isSelected ? '#f9fafb' : 'var(--text-muted)',
                          }}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <span className="font-medium truncate">{c.label}</span>
                        </button>
                        {c.subCategories && (isSelected || isSubSelected) && (
                          <div className="grid grid-cols-3 gap-1 mt-1 mb-1 ml-3">
                            {c.subCategories.map(sub => (
                              <button
                                key={sub.key}
                                onClick={() => { setEditCategory(sub.key); setCategoryPickerOpen(false) }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-left text-[11px] transition-all duration-100"
                                style={{
                                  background: editCategory === sub.key ? sub.color + '18' : 'transparent',
                                  border: '1px solid',
                                  borderColor: editCategory === sub.key ? sub.color + '60' : 'var(--border-subtle)',
                                  color: editCategory === sub.key ? '#f9fafb' : 'var(--text-muted)',
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sub.color }} />
                                <span className="font-medium">{sub.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Exclude toggle */}
          <div
            className="flex items-center justify-between px-2.5 py-2 rounded-lg"
            style={{ border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              {excluded ? <EyeOff size={13} style={{ color: '#ef4444' }} /> : <Eye size={13} style={{ color: 'var(--text-muted)' }} />}
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Exclude from totals</span>
            </div>
            <button
              onClick={() => setExcluded(!excluded)}
              className="relative w-9 h-[18px] rounded-full transition-colors duration-200"
              style={{ background: excluded ? '#ef4444' : 'var(--border-subtle)' }}
            >
              <span
                className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-transform duration-200"
                style={{
                  background: '#fff',
                  left: 2,
                  transform: excluded ? 'translateX(18px)' : 'translateX(0)',
                }}
              />
            </button>
          </div>
        </div>

        {/* Sticky save button */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card, #111827)' }}>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}

function DetailRow({ label, value, mono, color, last }) {
  return (
    <div
      className="flex items-baseline justify-between px-3 py-2"
      style={{ borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}
    >
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        className={`text-xs font-medium text-right max-w-[60%] ${mono ? 'font-mono' : ''}`}
        style={{ color: color || 'var(--text-primary)', wordBreak: 'break-word' }}
      >
        {value}
      </span>
    </div>
  )
}

/* ───────── Category Detail View ───────── */

function CategoryDetailView({ categoryKey, transactions, prevPeriodTransactions, onBack, onTransactionClick, categoryColor, txnToOverviewMap, membersByUserId = {} }) {
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [merchantFilter, setMerchantFilter] = useState(null)

  const cfg = findCategory(categoryKey) || { key: categoryKey, label: categoryKey, color: '#6b7280' }
  const color = categoryColor || cfg.color

  // Category transactions — include sub-category transactions when viewing a parent category
  const parentCfg = STATEMENT_CATEGORIES.find(c => c.key === categoryKey)
  const matchKeys = useMemo(() => {
    const keys = new Set([categoryKey])
    if (parentCfg?.subCategories) {
      for (const sub of parentCfg.subCategories) keys.add(sub.key)
    }
    return keys
  }, [categoryKey, parentCfg])

  const categoryTxns = useMemo(() =>
    transactions.filter(t => matchKeys.has(resolveCategory(t.category || 'other_general'))),
    [transactions, matchKeys]
  )

  const prevCategoryTxns = useMemo(() =>
    (prevPeriodTransactions || []).filter(t => matchKeys.has(resolveCategory(t.category || 'other_general')) && t.amount > 0),
    [prevPeriodTransactions, matchKeys]
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
          {isGeneralCategory(categoryKey) ? cfg.label : (() => {
            const parent = findParentCategory(categoryKey)
            return parent ? (
              <span className="flex flex-col leading-tight">
                <span className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{parent.label}</span>
                <span>{cfg.label}</span>
              </span>
            ) : cfg.label
          })()}
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
                {Object.keys(membersByUserId).length > 1 && (
                  <th
                    className="px-2 py-1.5 text-center"
                    style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: 32 }}
                  >
                    User
                  </th>
                )}
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
                {txnToOverviewMap && (
                  <th
                    className="px-2 py-1.5 text-center"
                    style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: 32 }}
                  >
                    <Link2 size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedTxns.slice(0, 50).map((txn, i) => {
                const linkedKey = txnToOverviewMap ? txnToOverviewMap[txn.id] : null
                return (
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
                  {Object.keys(membersByUserId).length > 1 && (
                    <td className="px-2 py-2 text-center" style={{ width: 32 }}>
                      <TransactionUserBadge userId={txn.syncedByUserId} membersByUserId={membersByUserId} />
                    </td>
                  )}
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
                  {txnToOverviewMap && (
                    <td className="px-2 py-2 text-center" style={{ width: 32 }}>
                      <span
                        title={linkedKey ? 'Linked to overview item' : ''}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full"
                        style={{
                          color: linkedKey ? 'var(--accent-blue)' : 'transparent',
                          background: linkedKey ? 'color-mix(in srgb, var(--accent-blue) 12%, transparent)' : 'transparent',
                        }}
                      >
                        {linkedKey && <Link2 size={11} strokeWidth={2.2} />}
                      </span>
                    </td>
                  )}
                </tr>
                )
              })}
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

export default function CategoryExplorer({
  transactions = [], onTransactionUpdate,
  oneTimePurchases = [], oneTimeExpenses = [], oneTimeIncome = [],
  transactionLinks = {}, txnToOverviewMap = {},
  onLinkTransaction, onUnlinkTransaction,
  membersByUserId = {},
}) {
  // Time period
  const [period, setPeriod] = useState('thisMonth')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Category filters
  const [hiddenCategories, setHiddenCategories] = useState(loadHiddenCategories)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const filterRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showFilterDropdown) return
    function handleClick(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFilterDropdown])

  const toggleHideCategory = useCallback((key) => {
    setHiddenCategories(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveHiddenCategories(next)
      return next
    })
  }, [])

  const unhideCategory = useCallback((key) => {
    setHiddenCategories(prev => {
      const next = new Set(prev)
      next.delete(key)
      saveHiddenCategories(next)
      return next
    })
  }, [])

  // Drill-down
  const [drillCategory, setDrillCategory] = useState(null)
  const [selectedTxn, setSelectedTxn] = useState(null)
  const [linkModalTxn, setLinkModalTxn] = useState(null)

  const hasLinking = !!(onLinkTransaction && (oneTimePurchases.length || oneTimeExpenses.length || oneTimeIncome.length))

  // Persist recently used categories to localStorage
  const [recentCategoryKeys, setRecentCategoryKeys] = useState(loadRecentCategoryKeys)

  const recentCategories = useMemo(() => {
    return recentCategoryKeys
      .map(key => findCategory(key))
      .filter(Boolean)
  }, [recentCategoryKeys])

  // Build a lookup for overview items by key
  const overviewItemsByKey = useMemo(() => {
    const map = {}
    for (const p of oneTimePurchases) map[`otp_${p.id}`] = { ...p, _type: 'otp' }
    for (const e of oneTimeExpenses) map[`ote_${e.id}`] = { ...e, _type: 'ote' }
    for (const i of oneTimeIncome) map[`oti_${i.id}`] = { ...i, _type: 'oti' }
    return map
  }, [oneTimePurchases, oneTimeExpenses, oneTimeIncome])

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

  const handleTransactionUpdate = useCallback((txnId, updates, statementId) => {
    if (onTransactionUpdate) onTransactionUpdate(txnId, updates, statementId)
    // Persist recently used category to localStorage
    if (updates.category) {
      const newKeys = saveRecentCategoryKey(updates.category)
      setRecentCategoryKeys(newKeys)
    }
    // Update the selected transaction locally so the UI reflects changes immediately
    setSelectedTxn(prev => prev?.id === txnId ? { ...prev, ...updates } : prev)
  }, [onTransactionUpdate])

  return (
    <div className="space-y-4">
      {/* Time period selector + category filter */}
      <div className="space-y-2">
        <TimePeriodSelector
          value={period}
          onChange={setPeriod}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={handleCustomChange}
        />

        {/* Category filter button + hidden pills */}
        <div className="flex items-center gap-2 flex-wrap ml-5">
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150"
              style={{
                background: hiddenCategories.size > 0 ? 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' : 'var(--bg-subtle, rgba(255,255,255,0.06))',
                color: hiddenCategories.size > 0 ? 'var(--accent-blue)' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: hiddenCategories.size > 0 ? 'color-mix(in srgb, var(--accent-blue) 40%, transparent)' : 'var(--border-subtle)',
              }}
            >
              <Filter size={12} />
              Filters
              {hiddenCategories.size > 0 && (
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--accent-blue)', color: '#fff' }}
                >
                  {hiddenCategories.size}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {showFilterDropdown && (
              <div
                className="absolute z-30 mt-1.5 rounded-xl shadow-2xl py-2 overflow-y-auto"
                style={{
                  background: 'var(--bg-card, #111827)',
                  border: '1px solid var(--border-default)',
                  minWidth: 220,
                  maxHeight: 340,
                  left: 0,
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pb-1.5 mb-1" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                  Hide categories
                </p>
                {STATEMENT_CATEGORIES.map(c => {
                  const isHidden = hiddenCategories.has(c.key)
                  return (
                    <button
                      key={c.key}
                      onClick={() => toggleHideCategory(c.key)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors duration-100 hover:bg-white/5"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center transition-all duration-100"
                        style={{
                          border: '1.5px solid',
                          borderColor: isHidden ? '#ef4444' : 'var(--border-subtle)',
                          background: isHidden ? '#ef444420' : 'transparent',
                        }}
                      >
                        {isHidden && <EyeOff size={9} style={{ color: '#ef4444' }} />}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: c.color, opacity: isHidden ? 0.35 : 1 }}
                      />
                      <span
                        className="font-medium"
                        style={{ color: isHidden ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isHidden ? 'line-through' : 'none' }}
                      >
                        {c.label}
                      </span>
                    </button>
                  )
                })}
                {hiddenCategories.size > 0 && (
                  <div className="px-3 pt-2 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      onClick={() => { const empty = new Set(); saveHiddenCategories(empty); setHiddenCategories(empty) }}
                      className="text-[10px] font-medium px-2 py-1 rounded-full transition-colors"
                      style={{ color: 'var(--accent-blue)', background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' }}
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hidden category pills */}
          {[...hiddenCategories].map(key => {
            const cfg = STATEMENT_CATEGORIES.find(c => c.key === key)
            if (!cfg) return null
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium transition-all duration-150"
                style={{
                  background: cfg.color + '15',
                  border: '1px solid ' + cfg.color + '30',
                  color: cfg.color,
                }}
              >
                <EyeOff size={10} />
                {cfg.label}
                <button
                  onClick={() => unhideCategory(key)}
                  className="ml-0.5 p-0.5 rounded-full transition-colors hover:bg-white/10"
                  style={{ color: cfg.color }}
                >
                  <X size={11} />
                </button>
              </span>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      {drillCategory ? (
        <CategoryDetailView
          categoryKey={drillCategory}
          transactions={filteredTxns}
          prevPeriodTransactions={prevPeriodTxns}
          onBack={handleBack}
          onTransactionClick={(onTransactionUpdate || hasLinking) ? handleTransactionClick : undefined}
          categoryColor={findCategory(drillCategory)?.color}
          txnToOverviewMap={hasLinking ? txnToOverviewMap : undefined}
          membersByUserId={membersByUserId}
        />
      ) : (
        <CategoryDonutChart
          transactions={filteredTxns}
          onCategoryClick={handleCategoryClick}
          hiddenCategories={hiddenCategories}
        />
      )}

      {/* Transaction detail drawer */}
      {selectedTxn && (() => {
        const selLinkedKey = txnToOverviewMap[selectedTxn.id] || null
        const selLinkedItem = selLinkedKey ? overviewItemsByKey[selLinkedKey] : null
        return (
          <TransactionDrawer
            transaction={selectedTxn}
            onClose={() => setSelectedTxn(null)}
            onUpdate={handleTransactionUpdate}
            linkedItem={selLinkedItem}
            linkedKey={selLinkedKey}
            onOpenLinkModal={hasLinking ? (txn) => { setLinkModalTxn(txn) } : undefined}
            onUnlink={onUnlinkTransaction ? (key, txnId) => { onUnlinkTransaction(key, txnId) } : undefined}
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
    </div>
  )
}
