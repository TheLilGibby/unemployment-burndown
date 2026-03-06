import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { STATEMENT_CATEGORIES, findCategory, getParentCategoryKey } from '../../constants/categories'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      className="rounded-xl px-3 py-2.5 shadow-2xl"
      style={{ background: '#111827', border: '1px solid #374151' }}
    >
      <p className="text-sm font-semibold text-white mb-0.5">{d.label}</p>
      <p className="text-sm font-bold" style={{ color: d.color }}>
        {formatCurrency(d.value)}
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
      {d.clickable && (
        <p className="text-[10px] mt-1.5 pt-1" style={{ color: '#6b7280', borderTop: '1px solid #374151' }}>
          Click to drill down
        </p>
      )}
    </div>
  )
}

export default function CategoryDonutChart({ transactions = [], onCategoryClick, hiddenCategories = new Set() }) {
  const [active, setActive] = useState(null)
  const [animDone, setAnimDone] = useState(false)

  const slices = useMemo(() => {
    // Group by parent category so sub-categories roll up into their parent slice
    const byCategory = {}
    for (const txn of transactions) {
      if (txn.amount <= 0) continue
      const parentKey = getParentCategoryKey(txn.category || 'other_general')
      if (hiddenCategories.has(parentKey)) continue
      if (!byCategory[parentKey]) byCategory[parentKey] = { total: 0, merchants: {} }
      byCategory[parentKey].total += txn.amount
      const merchant = txn.merchantName || txn.description || 'Unknown'
      byCategory[parentKey].merchants[merchant] = (byCategory[parentKey].merchants[merchant] || 0) + txn.amount
    }

    const raw = Object.entries(byCategory).map(([key, data]) => {
      const cfg = STATEMENT_CATEGORIES.find(c => c.key === key) || { key, label: key, color: '#6b7280' }
      const topItems = Object.entries(data.merchants)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
        .map(([name, amount]) => ({ name, amount }))
      return { key, label: cfg.label, value: data.total, color: cfg.color, topItems, clickable: !!onCategoryClick }
    }).sort((a, b) => b.value - a.value)

    const total = raw.reduce((s, x) => s + x.value, 0)
    return raw.map(s => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }))
  }, [transactions, onCategoryClick, hiddenCategories])

  const total = slices.reduce((s, x) => s + x.value, 0)

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 260, color: '#6b7280' }}
      >
        No transaction data for this period.
      </div>
    )
  }

  const handleSliceClick = (categoryKey) => {
    if (onCategoryClick) onCategoryClick(categoryKey)
  }

  return (
    <div className="flex flex-col sm:flex-row items-start gap-6" style={{ minHeight: 260 }}>
      {/* Donut */}
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
              {slices.map((s, i) => (
                <Cell
                  key={s.key}
                  fill={s.color}
                  opacity={active === null || active === i ? 1 : 0.45}
                  style={{ cursor: onCategoryClick ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
                  onClick={() => handleSliceClick(s.key)}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label — hidden while a slice tooltip is visible */}
        <div
          style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center', pointerEvents: 'none',
            opacity: active === null ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
        >
          <p className="text-lg font-bold text-white leading-tight">{formatCurrency(total)}</p>
          <p className="text-xs" style={{ color: '#6b7280' }}>total</p>
        </div>
      </div>

      {/* Legend breakdown */}
      <div className="flex-1 min-w-0 space-y-2 w-full">
        {slices.map((slice, i) => {
          const isHovered = active === i
          return (
            <div
              key={slice.key}
              className={onCategoryClick ? 'cursor-pointer' : 'cursor-default'}
              onMouseEnter={() => animDone && setActive(i)}
              onMouseLeave={() => animDone && setActive(null)}
              onClick={() => handleSliceClick(slice.key)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block rounded-full flex-shrink-0 transition-transform duration-150"
                    style={{
                      width: 8, height: 8,
                      background: slice.color,
                      transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                    }}
                  />
                  <span
                    className="text-sm font-medium transition-colors duration-150"
                    style={{ color: isHovered ? '#f9fafb' : '#d1d5db' }}
                  >
                    {slice.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums" style={{ color: '#6b7280' }}>
                    {Math.round(slice.pct)}%
                  </span>
                  <span
                    className="text-sm font-semibold tabular-nums transition-colors duration-150"
                    style={{ color: isHovered ? slice.color : '#e5e7eb' }}
                  >
                    {formatCurrency(slice.value)}
                  </span>
                  {onCategoryClick && (
                    <ChevronRight
                      size={14}
                      className="transition-all duration-150"
                      style={{
                        color: isHovered ? slice.color : 'transparent',
                        transform: isHovered ? 'translateX(0)' : 'translateX(-4px)',
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${slice.pct}%`,
                    background: slice.color,
                    opacity: isHovered ? 1 : 0.7,
                  }}
                />
              </div>

              {/* Top merchants on hover */}
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
                      <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
