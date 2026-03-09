import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: 'All', months: Infinity },
]

function CustomTooltip({ active, payload, c }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-sm shadow-2xl min-w-[200px]"
      style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}` }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: c.textSecondary }}>{d.dateLabel}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-xs" style={{ color: c.textSecondary }}>Balance Change</span>
          <span
            className="font-semibold text-xs"
            style={{ color: d.balanceChange >= 0 ? c.emerald : c.red }}
          >
            {d.balanceChange >= 0 ? '+' : ''}{formatCurrency(d.balanceChange)}
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-xs" style={{ color: c.textSecondary }}>Savings Rate</span>
          <span
            className="font-semibold text-xs"
            style={{ color: d.savingsRate >= 0 ? c.emerald : c.red }}
          >
            {d.savingsRate >= 0 ? '+' : ''}{d.savingsRate.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between gap-6 pt-1 mt-1" style={{ borderTop: `1px solid ${c.tooltipBorder}` }}>
          <span className="text-xs" style={{ color: c.textSecondary }}>Cumulative</span>
          <span
            className="font-bold text-xs"
            style={{ color: d.cumulativeChange >= 0 ? c.emerald : c.red }}
          >
            {d.cumulativeChange >= 0 ? '+' : ''}{formatCurrency(d.cumulativeChange)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function SavingsVelocityChart({ dataPoints }) {
  const c = useChartColors()
  const [zoom, setZoom] = useState('1Y')
  const zoomMonths = ZOOM_OPTIONS.find(z => z.label === zoom)?.months ?? Infinity

  const chartData = useMemo(() => {
    if (!dataPoints?.length) return []

    let cumulative = 0
    const raw = []
    for (let i = 1; i < dataPoints.length; i++) {
      const pt = dataPoints[i]
      const prev = dataPoints[i - 1]
      if (pt.month > zoomMonths) break

      const balanceChange = pt.balance - prev.balance
      const income = pt.income || 0
      const savingsRate = income > 0 ? (balanceChange / income) * 100 : 0
      cumulative += balanceChange

      raw.push({
        dateLabel: pt.dateLabel,
        month: pt.month,
        balanceChange,
        savingsRate: Math.max(-100, Math.min(100, savingsRate)),
        cumulativeChange: cumulative,
      })
    }

    const MAX = 60
    const step = Math.max(1, Math.ceil(raw.length / MAX))
    return raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
  }, [dataPoints, zoomMonths])

  if (!chartData.length) return null

  const maxChange = Math.max(...chartData.map(d => Math.abs(d.balanceChange)), 1)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs" style={{ color: c.tick }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c.withAlpha(c.emerald, 'bb') }} />
            Saved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c.withAlpha(c.red, 'bb') }} />
            Drawn down
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: c.amber }} />
            Cumulative
          </span>
        </div>
        <div className="flex gap-1">
          {ZOOM_OPTIONS.map(z => (
            <button
              key={z.label}
              onClick={() => setZoom(z.label)}
              className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
              style={{
                borderColor: zoom === z.label ? 'var(--accent-blue)' : 'var(--border-subtle)',
                background: zoom === z.label ? 'var(--accent-blue)' + '20' : 'transparent',
                color: zoom === z.label ? 'var(--accent-blue)' : 'var(--text-faint)',
              }}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sensitive-chart" style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: c.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="change"
              tickFormatter={v => {
                const a = Math.abs(v)
                const prefix = v < 0 ? '-' : ''
                return prefix + '$' + (a >= 1000 ? (a / 1000).toFixed(0) + 'k' : a)
              }}
              tick={{ fill: c.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={[-maxChange * 1.15, maxChange * 1.15]}
            />
            <YAxis
              yAxisId="cumulative"
              orientation="right"
              tickFormatter={v => {
                const a = Math.abs(v)
                const prefix = v < 0 ? '-' : ''
                return prefix + '$' + (a >= 1000 ? (a / 1000).toFixed(0) + 'k' : a)
              }}
              tick={{ fill: c.amber, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip c={c} />} />
            <ReferenceLine yAxisId="change" y={0} stroke={c.tooltipBorder} strokeWidth={1.5} />

            <Bar yAxisId="change" dataKey="balanceChange" radius={[2, 2, 0, 0]} maxBarSize={18}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.balanceChange >= 0 ? c.withAlpha(c.emerald, 'bb') : c.withAlpha(c.red, 'bb')} />
              ))}
            </Bar>

            <Line
              yAxisId="cumulative"
              type="monotone"
              dataKey="cumulativeChange"
              stroke={c.amber}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
