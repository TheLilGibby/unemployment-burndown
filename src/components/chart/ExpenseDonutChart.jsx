import { useMemo, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { getEffectivePayment } from '../../utils/ccPayment'

const SLICE_CONFIG = [
  { key: 'essential',     label: 'Essential',     color: '#3b82f6' },
  { key: 'discretionary', label: 'Discretionary', color: '#f97316' },
  { key: 'subscriptions', label: 'Subscriptions', color: '#a78bfa' },
  { key: 'ccPayments',    label: 'CC Payments',   color: '#f59e0b' },
  { key: 'investments',   label: 'Investments',   color: '#14b8a6' },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const cfg = SLICE_CONFIG.find(c => c.key === d.key)
  return (
    <div
      className="rounded-xl px-3 py-2.5 shadow-2xl"
      style={{ background: '#111827', border: '1px solid #374151' }}
    >
      <p className="text-sm font-semibold text-white mb-0.5">{d.label}</p>
      <p className="text-sm font-bold" style={{ color: cfg?.color ?? '#fff' }}>
        {formatCurrency(d.value)}<span className="text-xs font-normal opacity-60">/mo</span>
      </p>
      <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
        {Math.round(d.pct)}% of total
      </p>
      {d.topItems?.length > 0 && (
        <div className="mt-1.5 pt-1.5 space-y-0.5" style={{ borderTop: '1px solid #374151' }}>
          {d.topItems.map((item, i) => (
            <div key={i} className="flex justify-between gap-3 text-xs" style={{ color: '#9ca3af' }}>
              <span className="truncate max-w-[120px]">{item.name}</span>
              <span>{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Percentage label rendered on each donut slice */
function renderSliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, pct, key }) {
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const cfg = SLICE_CONFIG.find(c => c.key === key)

  if (pct < 5) return null // don't render labels for tiny slices

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      style={{
        fontSize: 11,
        fontWeight: 700,
        fill: '#fff',
        textShadow: `0 1px 3px ${cfg?.color ?? '#000'}`,
        pointerEvents: 'none',
      }}
    >
      {Math.round(pct)}%
    </text>
  )
}

/** iOS-style mini toggle */
function Toggle({ checked, onChange, size = 'sm' }) {
  const w = size === 'sm' ? 'w-7' : 'w-9'
  const h = size === 'sm' ? 'h-4' : 'h-5'
  const dot = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'
  const tx = size === 'sm' ? 'translateX(13px)' : 'translateX(17px)'
  const t0 = size === 'sm' ? 'translateX(3px)' : 'translateX(3px)'

  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex ${h} ${w} shrink-0 items-center rounded-full transition-colors duration-200`}
      style={{ background: checked ? 'var(--accent-blue, #3b82f6)' : '#374151' }}
    >
      <span
        className={`inline-block ${dot} rounded-full bg-white shadow-sm transition-transform duration-200`}
        style={{ transform: checked ? tx : t0 }}
      />
    </button>
  )
}

export default function ExpenseDonutChart({ expenses, subscriptions, creditCards, investments }) {
  const [active, setActive] = useState(null)
  const [animDone, setAnimDone] = useState(false)

  const toggleCategory = useCallback((key) => {
    setHiddenKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const allSlices = useMemo(() => {
    const essential = expenses.filter(e => e.essential)
    const discretionary = expenses.filter(e => !e.essential)
    const activeSubs = subscriptions.filter(s => s.active !== false)
    const ccItems = creditCards.filter(c => getEffectivePayment(c) > 0)
    const activeInvest = investments.filter(i => i.active !== false)

    return [
      {
        key: 'essential',
        label: 'Essential',
        value: essential.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0),
        topItems: essential.sort((a, b) => b.monthlyAmount - a.monthlyAmount).slice(0, 4)
          .map(e => ({ name: e.category || 'Expense', amount: Number(e.monthlyAmount) })),
      },
      {
        key: 'discretionary',
        label: 'Discretionary',
        value: discretionary.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0),
        topItems: discretionary.sort((a, b) => b.monthlyAmount - a.monthlyAmount).slice(0, 4)
          .map(e => ({ name: e.category || 'Expense', amount: Number(e.monthlyAmount) })),
      },
      {
        key: 'subscriptions',
        label: 'Subscriptions',
        value: activeSubs.reduce((s, x) => s + (Number(x.monthlyAmount) || 0), 0),
        topItems: activeSubs.sort((a, b) => b.monthlyAmount - a.monthlyAmount).slice(0, 4)
          .map(s => ({ name: s.name || 'Sub', amount: Number(s.monthlyAmount) })),
      },
      {
        key: 'ccPayments',
        label: 'CC Payments',
        value: ccItems.reduce((s, c) => s + getEffectivePayment(c), 0),
        topItems: [...ccItems].sort((a, b) => getEffectivePayment(b) - getEffectivePayment(a)).slice(0, 4)
          .map(c => ({ name: c.name || 'Card', amount: getEffectivePayment(c) })),
      },
      {
        key: 'investments',
        label: 'Investments',
        value: activeInvest.reduce((s, i) => s + (Number(i.monthlyAmount) || 0), 0),
        topItems: activeInvest.sort((a, b) => b.monthlyAmount - a.monthlyAmount).slice(0, 4)
          .map(i => ({ name: i.name || 'Investment', amount: Number(i.monthlyAmount) })),
      },
    ].filter(s => s.value > 0)
  }, [expenses, subscriptions, creditCards, investments])

  // Visible slices (after hiding) with recalculated percentages
  const slices = useMemo(() => {
    const visible = allSlices.filter(s => !hiddenKeys.has(s.key))
    const total = visible.reduce((s, x) => s + x.value, 0)
    return visible.map(s => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }))
  }, [allSlices, hiddenKeys])

  const total = slices.reduce((s, x) => s + x.value, 0)
  const hasHidden = hiddenKeys.size > 0

  if (allSlices.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 260, color: '#6b7280' }}
      >
        No expense data to display yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6" style={{ minHeight: 260 }}>

      {/* ── Donut ── */}
      <div style={{ width: 210, height: 210, flexShrink: 0, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              paddingAngle={2}
              strokeWidth={0}
              onMouseEnter={(_, idx) => animDone && setActive(idx)}
              onMouseLeave={() => animDone && setActive(null)}
              onAnimationEnd={() => setAnimDone(true)}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Legend breakdown ── */}
      <div className="flex-1 min-w-0 space-y-3 w-full">
        {slices.map((slice, i) => {
          const cfg = SLICE_CONFIG.find(c => c.key === slice.key)
          const isHovered = active === i
          return (
            <div
              key={slice.key}
              className="cursor-default"
              onMouseEnter={() => animDone && setActive(i)}
              onMouseLeave={() => animDone && setActive(null)}
            >
              {/* Row: label + pct + amount */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block rounded-full flex-shrink-0 transition-transform"
                    style={{
                      width: `${slice.pct}%`,
                      background: cfg?.color ?? '#6b7280',
                      opacity: isHovered ? 1 : 0.7,
                    }}
                  />
                </div>

                {/* Top items on hover */}
                {slice.topItems.length > 0 && (
                  <div
                    className="ml-3 space-y-0.5 overflow-hidden transition-all duration-200"
                    style={{
                      maxHeight: isHovered ? slice.topItems.length * 24 : 0,
                      opacity: isHovered ? 1 : 0,
                      marginTop: isHovered ? 4 : 0,
                    }}
                  >
                    {slice.topItems.map((item, j) => (
                      <div key={j} className="flex justify-between text-xs" style={{ color: '#6b7280' }}>
                        <span className="truncate mr-2 max-w-[55%]">{item.name}</span>
                        <span className="tabular-nums">{formatCurrency(item.amount)}/mo</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Indicator when categories are hidden */}
          {hasHidden && (
            <div className="pt-2" style={{ borderTop: '1px solid #1f2937' }}>
              <p className="text-[11px]" style={{ color: '#6b7280' }}>
                {hiddenKeys.size} {hiddenKeys.size === 1 ? 'category' : 'categories'} hidden
                {' — '}
                <button
                  onClick={() => setHiddenKeys(new Set())}
                  className="transition-colors"
                  style={{ color: 'var(--accent-blue, #3b82f6)' }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                >
                  show all
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
