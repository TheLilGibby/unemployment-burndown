import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-sm shadow-2xl min-w-[200px]">
      <p className="text-gray-400 text-xs mb-2 font-semibold uppercase tracking-wide">{d.dateLabel}</p>

      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-400 text-xs">Income</span>
        <span className="text-emerald-300 font-bold">{formatCurrency(d.income)}</span>
      </div>

      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-400 text-xs">Expenses</span>
        <span className="text-red-400 font-bold">{formatCurrency(d.expenses)}</span>
      </div>

      <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-700">
        <span className="text-gray-400 text-xs font-semibold">Net Cash Flow</span>
        <span
          className="font-bold"
          style={{ color: d.netFlow >= 0 ? '#34d399' : '#f87171' }}
        >
          {d.netFlow >= 0 ? `+${formatCurrency(d.netFlow)}` : `−${formatCurrency(Math.abs(d.netFlow))}`}
        </span>
      </div>
    </div>
  )
}

export default function CashFlowSummaryChart({ dataPoints, months = 12 }) {
  const data = useMemo(() => {
    const pts = dataPoints.slice(0, months + 1)
    return pts.map((d, i) => {
      const prev = i > 0 ? pts[i - 1] : null
      const balanceChange = prev ? d.balance - prev.balance : 0
      const income = d.income || 0
      // Approximate expenses from the data
      const expenses = income > 0
        ? Math.max(0, income - balanceChange)
        : Math.abs(Math.min(0, balanceChange))
      return {
        dateLabel: d.dateLabel,
        income,
        expenses,
        netFlow: income - expenses,
      }
    }).slice(1) // skip first point (no delta)
  }, [dataPoints, months])

  if (data.length === 0) return null

  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expenses]))

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.4} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            tickLine={false}
            axisLine={false}
            domain={[0, maxVal * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} />

          <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} name="Income" opacity={0.85} />
          <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expenses" opacity={0.85} />

          <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" opacity={0.4} />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#10b981', opacity: 0.85 }} />
          <span style={{ color: 'var(--text-muted)' }}>Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#ef4444', opacity: 0.85 }} />
          <span style={{ color: 'var(--text-muted)' }}>Expenses</span>
        </div>
      </div>
    </div>
  )
}
