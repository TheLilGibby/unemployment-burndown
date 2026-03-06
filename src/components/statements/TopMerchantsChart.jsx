import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { STATEMENT_CATEGORIES } from '../../constants/categories'

const CATEGORY_MAP = Object.fromEntries(STATEMENT_CATEGORIES.map(c => [c.key, c]))

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const cat = CATEGORY_MAP[d.categoryKey]
  return (
    <div
      className="rounded-xl px-3 py-2.5 shadow-2xl"
      style={{ background: '#111827', border: '1px solid #374151' }}
    >
      <p className="text-sm font-semibold text-white mb-0.5">{d.fullName}</p>
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: cat?.color || '#6b7280' }}
        />
        <span className="text-xs" style={{ color: cat?.color || '#6b7280' }}>
          {cat?.label || 'Other'}
        </span>
      </div>
      <p className="text-sm font-bold" style={{ color: cat?.color || 'var(--accent-blue)' }}>
        {formatCurrency(d.total)}
      </p>
      <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
        {d.count} transaction{d.count !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

function ValueLabel(props) {
  const { x, y, width, height, value } = props
  if (!value) return null
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill="var(--text-muted)"
      fontSize={11}
      fontWeight={600}
      dominantBaseline="central"
      fontFamily="var(--font-mono, ui-monospace, monospace)"
    >
      {formatCurrency(value)}
    </text>
  )
}

function CategoryLabel(props) {
  const { x, y, width, height, value } = props
  if (!value || width < 50) return null
  const cat = CATEGORY_MAP[value]
  if (!cat) return null
  return (
    <text
      x={x + 8}
      y={y + height / 2}
      fill="rgba(255,255,255,0.85)"
      fontSize={10}
      fontWeight={500}
      dominantBaseline="central"
    >
      {cat.label}
    </text>
  )
}

export default function TopMerchantsChart({ transactions = [] }) {
  const data = useMemo(() => {
    const byMerchant = {}
    for (const txn of transactions) {
      if (txn.amount <= 0) continue
      const merchant = txn.merchantName || txn.description || 'Unknown'
      const cat = txn.category || 'other'
      if (!byMerchant[merchant]) byMerchant[merchant] = { total: 0, count: 0, categories: {} }
      byMerchant[merchant].total += txn.amount
      byMerchant[merchant].count++
      byMerchant[merchant].categories[cat] = (byMerchant[merchant].categories[cat] || 0) + txn.amount
    }

    return Object.entries(byMerchant)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 15)
      .map(([merchant, data]) => {
        // Find the dominant category for this merchant
        const topCat = Object.entries(data.categories)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || 'other'
        const catCfg = CATEGORY_MAP[topCat]
        return {
          merchant: merchant.length > 22 ? merchant.slice(0, 20) + '...' : merchant,
          fullName: merchant,
          total: Math.round(data.total),
          count: data.count,
          categoryKey: topCat,
          color: catCfg?.color || '#6b7280',
        }
      })
  }, [transactions])

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 260, color: '#6b7280' }}
      >
        No merchant data yet.
      </div>
    )
  }

  return (
    <div style={{ height: Math.max(280, data.length * 36 + 50) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 90, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-subtle)"
            horizontal={false}
            opacity={0.5}
          />
          <XAxis
            type="number"
            tickFormatter={v => {
              if (v === 0) return '$0'
              if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
              return `$${v}`
            }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border-subtle)' }}
            tickLine={{ stroke: 'var(--border-subtle)', strokeWidth: 0.5 }}
            tickCount={6}
          />
          <YAxis
            type="category"
            dataKey="merchant"
            tick={{ fill: 'var(--text-secondary, var(--text-muted))', fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={150}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar
            dataKey="total"
            radius={[0, 6, 6, 0]}
            maxBarSize={28}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} fillOpacity={0.85} />
            ))}
            <LabelList dataKey="total" content={<ValueLabel />} />
            <LabelList dataKey="categoryKey" content={<CategoryLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
