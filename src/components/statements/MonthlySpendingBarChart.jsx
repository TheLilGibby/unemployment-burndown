import { useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { getParentCategoryKey } from '../../constants/categories'

const RETAINED_CATEGORIES = new Set(['investments', 'transfer', 'ccPayment'])

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div
      className="rounded-xl px-3 py-2.5 shadow-2xl min-w-[200px]"
      style={{ background: '#111827', border: '1px solid #374151' }}
    >
      <p className="text-sm font-semibold text-white mb-1.5">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4 text-xs">
          <span style={{ color: '#6ee7b7' }}>Income</span>
          <span className="font-semibold" style={{ color: '#34d399' }}>
            {formatCurrency(d.inflow)}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span style={{ color: '#fca5a5' }}>True Expenses</span>
          <span className="font-semibold" style={{ color: '#f87171' }}>
            {formatCurrency(Math.abs(d.trueExpenses))}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span style={{ color: '#93c5fd' }}>Retained (Investments/Transfers)</span>
          <span className="font-semibold" style={{ color: '#60a5fa' }}>
            {formatCurrency(Math.abs(d.retained))}
          </span>
        </div>
        <div
          className="flex justify-between gap-4 text-xs pt-1 mt-1"
          style={{ borderTop: '1px solid #374151' }}
        >
          <span style={{ color: '#9ca3af' }}>Net Cash Flow</span>
          <span
            className="font-bold"
            style={{ color: d.net >= 0 ? '#34d399' : '#f87171' }}
          >
            {d.net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(d.net))}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function MonthlySpendingBarChart({ transactions = [], creditCards = [] }) {
  const data = useMemo(() => {
    const byMonth = {}
    for (const txn of transactions) {
      const month = txn.date?.slice(0, 7) // "YYYY-MM"
      if (!month) continue

      if (!byMonth[month]) {
        byMonth[month] = { inflow: 0, trueExpenses: 0, retained: 0 }
      }

      if (txn.amount < 0) {
        byMonth[month].inflow += Math.abs(txn.amount)
      } else if (txn.amount > 0) {
        const parentKey = getParentCategoryKey(txn.category)
        if (RETAINED_CATEGORIES.has(parentKey)) {
          byMonth[month].retained += txn.amount
        } else {
          byMonth[month].trueExpenses += txn.amount
        }
      }
    }

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, d]) => {
        const [yr, mo] = month.split('-')
        const label = new Date(Number(yr), Number(mo) - 1)
          .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        return {
          month: label,
          inflow: Math.round(d.inflow),
          trueExpenses: Math.round(-d.trueExpenses),
          retained: Math.round(-d.retained),
          net: Math.round(d.inflow - d.trueExpenses - d.retained),
        }
      })
  }, [transactions])

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 260, color: '#6b7280' }}
      >
        No monthly cash flow data yet.
      </div>
    )
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-3" style={{ color: '#9ca3af' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: '#22c55e' }} />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: '#ef4444' }} />
          True Expenses
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: '#3b82f6' }} />
          Retained
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-0.5 rounded" style={{ background: '#facc15' }} />
          Net
        </span>
      </div>

      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={v => {
                const abs = Math.abs(v)
                return `${v < 0 ? '-' : ''}$${abs >= 1000 ? (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'k' : abs}`
              }}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="var(--border-subtle)" strokeWidth={1} />

            {/* Inflow bar (positive, points up) */}
            <Bar dataKey="inflow" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />

            {/* True Expenses bar (negative, points down) - stacked with Retained */}
            <Bar dataKey="trueExpenses" name="True Expenses" stackId="outflow" fill="#ef4444" maxBarSize={40} />

            {/* Retained bar (negative, points down) - stacked on True Expenses */}
            <Bar dataKey="retained" name="Retained" stackId="outflow" fill="#3b82f6" radius={[0, 0, 4, 4]} maxBarSize={40} />

            {/* Net cash flow line overlay */}
            <Line
              dataKey="net" name="Net" type="monotone"
              stroke="#facc15" strokeWidth={2}
              dot={{ r: 3, fill: '#facc15' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
