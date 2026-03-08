import { useState } from 'react'
import dayjs from 'dayjs'
import { formatCurrency } from '../utils/formatters'
import { useBudget } from '../hooks/useBudget'
import { STATEMENT_CATEGORIES } from '../constants/categories'
import SectionCard from '../components/layout/SectionCard'
import CurrencyInput from '../components/finances/CurrencyInput'
import {
  TrendingDown, TrendingUp,
  Plus, Trash2, ToggleLeft, ToggleRight, BarChart3, Settings2,
  ChevronDown, ChevronUp,
} from 'lucide-react'

/* ---------- small helpers ------------------------------------------------- */

function ProgressBar({ pct, color }) {
  const clamped = Math.min(pct, 100)
  return (
    <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
        style={{ width: `${clamped}%`, background: pct > 100 ? 'var(--accent-red, #ef4444)' : color }}
      />
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums" style={{ color: color || 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  )
}

/* ---------- budget card --------------------------------------------------- */

function BudgetCard({ item }) {
  const statusColor = item.overBudget ? 'var(--accent-red, #ef4444)' : 'var(--accent-emerald, #10b981)'
  const StatusIcon = item.overBudget ? TrendingUp : TrendingDown

  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{
        background: 'var(--bg-card)',
        borderColor: item.overBudget ? 'var(--accent-red, #ef4444)' : 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: item.categoryColor }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.categoryLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon size={14} strokeWidth={1.75} style={{ color: statusColor }} />
          <span className="text-xs font-semibold tabular-nums" style={{ color: statusColor }}>
            {item.overBudget ? '+' : ''}{formatCurrency(Math.abs(item.diff))} {item.overBudget ? 'over' : 'under'}
          </span>
        </div>
      </div>

      <ProgressBar pct={item.pct} color={item.categoryColor} />

      <div className="flex items-center justify-between">
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {formatCurrency(item.actual)} of {formatCurrency(item.monthlyLimit)}
        </span>
        <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {Math.round(item.pct)}%
        </span>
      </div>
    </div>
  )
}

/* ---------- summary -------------------------------------------------------- */

function SummaryCards({ summary, variance }) {
  if (variance.length === 0) return null
  const totalDiff = summary.totalBudget - summary.totalActual
  const totalPct = summary.totalBudget > 0 ? (summary.totalActual / summary.totalBudget) * 100 : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard label="Total Budget" value={formatCurrency(summary.totalBudget)} />
      <StatCard label="Total Spent" value={formatCurrency(summary.totalActual)} color={totalPct > 100 ? 'var(--accent-red)' : undefined} />
      <StatCard label="Over Budget" value={summary.overCount} color={summary.overCount > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'} />
      <StatCard
        label="Net Variance"
        value={`${totalDiff >= 0 ? '+' : ''}${formatCurrency(totalDiff)}`}
        color={totalDiff >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
      />
    </div>
  )
}

/* ---------- variance table ------------------------------------------------ */

function VarianceTable({ variance }) {
  if (variance.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
            <th className="text-left py-2 pr-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Category</th>
            <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Budget</th>
            <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actual</th>
            <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Variance</th>
            <th className="text-right py-2 pl-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {variance.map(v => {
            const varColor = v.overBudget ? 'var(--accent-red, #ef4444)' : 'var(--accent-emerald, #10b981)'
            return (
              <tr key={v.categoryKey} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.categoryColor }} />
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{v.categoryLabel}</span>
                  </div>
                </td>
                <td className="text-right py-2.5 px-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(v.monthlyLimit)}</td>
                <td className="text-right py-2.5 px-3 tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatCurrency(v.actual)}</td>
                <td className="text-right py-2.5 px-3 tabular-nums font-medium" style={{ color: varColor }}>
                  {v.overBudget ? '-' : '+'}{formatCurrency(Math.abs(v.diff))}
                </td>
                <td className="text-right py-2.5 pl-3 tabular-nums font-medium" style={{ color: varColor }}>
                  {Math.round(v.pct)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ---------- budget setup -------------------------------------------------- */

const EXCLUDED_BUDGET_CATEGORIES = ['payroll', 'ccPayment', 'transfer', 'investments']

function BudgetSetup({ categoryBudgets, onChange, actualSpending }) {
  const [addingKey, setAddingKey] = useState('')
  const [expanded, setExpanded] = useState(true)

  const budgetedKeys = Object.keys(categoryBudgets)
  const unbudgetedCategories = STATEMENT_CATEGORIES.filter(
    c => !budgetedKeys.includes(c.key) && !EXCLUDED_BUDGET_CATEGORIES.includes(c.key),
  )

  function handleAdd() {
    if (!addingKey) return
    const cat = STATEMENT_CATEGORIES.find(c => c.key === addingKey)
    if (!cat) return
    // Auto-suggest based on actual spending (round up to nearest $50)
    const actual = actualSpending[addingKey] || 0
    const suggested = actual > 0 ? Math.ceil(actual / 50) * 50 : 200
    onChange(prev => ({
      ...prev,
      [addingKey]: { monthlyLimit: suggested, enabled: true },
    }))
    setAddingKey('')
  }

  return (
    <SectionCard>
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Settings2 size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Budget Settings
          </h2>
        </div>
        {expanded
          ? <ChevronUp size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
          : <ChevronDown size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {/* Add category budget */}
          <div className="flex items-center gap-2">
            <select
              value={addingKey}
              onChange={e => setAddingKey(e.target.value)}
              className="flex-1 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Add a category budget...</option>
              {unbudgetedCategories.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!addingKey}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Budget list */}
          {budgetedKeys.length === 0 && (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              No budgets set. Add a category above to start tracking spending limits.
            </p>
          )}

          <div className="space-y-2">
            {budgetedKeys.map(key => {
              const cat = STATEMENT_CATEGORIES.find(c => c.key === key)
              if (!cat) return null
              const budget = categoryBudgets[key]
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                  <span className="text-xs font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                    {cat.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                  <CurrencyInput
                    value={budget.monthlyLimit}
                    onChange={val => onChange(prev => ({
                      ...prev,
                      [key]: { ...prev[key], monthlyLimit: val },
                    }))}
                    className="w-20 text-xs text-right rounded px-1.5 py-1 focus:outline-none tabular-nums"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    onClick={() => onChange(prev => ({
                      ...prev,
                      [key]: { ...prev[key], enabled: !budget.enabled },
                    }))}
                    title={budget.enabled ? 'Disable' : 'Enable'}
                    className="p-1 rounded transition-colors"
                    style={{ color: budget.enabled ? 'var(--accent-emerald)' : 'var(--text-muted)' }}
                  >
                    {budget.enabled
                      ? <ToggleRight size={16} strokeWidth={1.75} />
                      : <ToggleLeft size={16} strokeWidth={1.75} />}
                  </button>
                  <button
                    onClick={() => onChange(prev => {
                      const next = { ...prev }
                      delete next[key]
                      return next
                    })}
                    title="Remove budget"
                    className="p-1 rounded transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

/* ---------- main page ----------------------------------------------------- */

export default function BudgetPage({
  categoryBudgets = {},
  onCategoryBudgetsChange,
  allTransactions = [],
  transactionOverrides = {},
}) {
  const [selectedMonth, setSelectedMonth] = useState(null)

  const {
    variance,
    summary,
    actualSpending,
    availableMonths,
    targetMonth,
  } = useBudget(categoryBudgets, allTransactions, transactionOverrides, selectedMonth)

  const [tab, setTab] = useState('dashboard')
  const hasBudgets = Object.keys(categoryBudgets).length > 0

  const monthLabel = dayjs(targetMonth + '-01').format('MMMM YYYY')

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-32 space-y-6">
      {/* Hero */}
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Budget Tracker</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Set spending limits and track category budgets</p>
      </div>

      {/* Tab nav + month selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-subtle)' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'setup', label: 'Settings', icon: Settings2 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: tab === t.id ? 'var(--bg-card)' : 'transparent',
                color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: tab === t.id ? '0 1px 2px rgba(0,0,0,.1)' : 'none',
              }}
            >
              <t.icon size={14} strokeWidth={1.75} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && availableMonths.length > 0 && (
          <select
            value={selectedMonth || targetMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
            }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{dayjs(m + '-01').format('MMM YYYY')}</option>
            ))}
          </select>
        )}
      </div>

      {tab === 'setup' && (
        <BudgetSetup
          categoryBudgets={categoryBudgets}
          onChange={onCategoryBudgetsChange}
          actualSpending={actualSpending}
        />
      )}

      {tab === 'dashboard' && (
        <>
          {!hasBudgets ? (
            <SectionCard>
              <div className="text-center py-12 space-y-3">
                <BarChart3 size={40} strokeWidth={1.25} className="mx-auto" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No budgets configured</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Switch to the Settings tab to set monthly spending limits for your categories.
                </p>
                <button
                  onClick={() => setTab('setup')}
                  className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--accent-blue)', color: '#fff' }}
                >
                  Set Up Budgets
                </button>
              </div>
            </SectionCard>
          ) : (
            <>
              <SummaryCards summary={summary} variance={variance} />

              {/* Progress cards */}
              <SectionCard title={`${monthLabel} \u2014 Category Progress`}>
                {variance.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                    No spending data found for {monthLabel}. Transactions from linked accounts will appear here.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {variance.map(v => <BudgetCard key={v.categoryKey} item={v} />)}
                  </div>
                )}
              </SectionCard>

              {/* Variance report table */}
              <SectionCard title="Monthly Variance Report">
                {variance.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
                    No budget data to display.
                  </p>
                ) : (
                  <VarianceTable variance={variance} />
                )}
              </SectionCard>
            </>
          )}
        </>
      )}
    </div>
  )
}
