import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '6M',  months: 6  },
  { label: '1Y',  months: 12 },
  { label: '2Y',  months: 24 },
  { label: '5Y',  months: 60 },
  { label: 'All', months: Infinity },
]

function CustomTooltip({ active, payload, c }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm shadow-2xl min-w-[220px]"
      style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}` }}
    >
      <p className="text-xs mb-2 font-semibold uppercase tracking-wide" style={{ color: c.textSecondary }}>{d.dateLabel}</p>

      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: c.textSecondary }}>Cash / Savings</span>
        <span className="font-bold" style={{ color: c.blue }}>{formatCurrency(d.balance)}</span>
      </div>

      {d.assetValue > 0 && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs" style={{ color: c.textSecondary }}>Assets</span>
          <span className="font-bold" style={{ color: c.purple }}>{formatCurrency(d.assetValue)}</span>
        </div>
      )}

      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: c.textSecondary }}>Total Debt</span>
        <span className="font-bold" style={{ color: c.red }}>
          {d.totalDebt > 0 ? `−${formatCurrency(d.totalDebt)}` : formatCurrency(0)}
        </span>
      </div>

      <div className="flex justify-between items-center mt-1 pt-1" style={{ borderTop: `1px solid ${c.tooltipBorder}` }}>
        <span className="text-xs font-semibold" style={{ color: c.textSecondary }}>Net Worth</span>
        <span
          className="font-bold"
          style={{ color: d.netWorth >= 0 ? c.emerald : c.red }}
        >
          {d.netWorth >= 0 ? formatCurrency(d.netWorth) : `−${formatCurrency(Math.abs(d.netWorth))}`}
        </span>
      </div>
    </div>
  )
}

export default function NetWorthTrendChart({ dataPoints, assetTotal = 0 }) {
  const c = useChartColors()
  const [zoom, setZoom] = useState(24)

  const data = useMemo(() => {
    const pts = dataPoints.map(d => ({
      ...d,
      assetValue: assetTotal,
      netWorth: d.balance + assetTotal - (d.totalDebt || 0),
    }))
    if (zoom === Infinity) return pts
    return pts.slice(0, zoom + 1)
  }, [dataPoints, assetTotal, zoom])

  const allValues = data.flatMap(d => [d.netWorth, d.balance, -(d.totalDebt || 0)])
  const maxVal = Math.max(...allValues, 0)
  const minVal = Math.min(...allValues, 0)

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-3">
        {ZOOM_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => setZoom(opt.months)}
            className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
            style={{
              background: zoom === opt.months ? c.blue : 'transparent',
              color: zoom === opt.months ? '#fff' : c.textMuted,
              border: zoom === opt.months ? 'none' : `1px solid ${c.borderSubtle}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="nwCashGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={c.blue} stopOpacity={0.25} />
              <stop offset="95%" stopColor={c.blue} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="nwNetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={c.emerald} stopOpacity={0.2} />
              <stop offset="95%" stopColor={c.emerald} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} opacity={0.4} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: c.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: c.tick, fontSize: 11 }}
            tickFormatter={v => {
              const abs = Math.abs(v)
              if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
              return `$${(v / 1000).toFixed(0)}k`
            }}
            tickLine={false}
            axisLine={false}
            domain={[minVal < 0 ? minVal * 1.1 : 0, maxVal * 1.05]}
          />
          <Tooltip content={<CustomTooltip c={c} />} />

          <Area
            type="monotone"
            dataKey="balance"
            stroke={c.blue}
            strokeWidth={1.5}
            fill="url(#nwCashGrad)"
            name="Cash"
            dot={false}
            activeDot={{ r: 3, stroke: c.blue, strokeWidth: 2, fill: '#1e3a5f' }}
          />

          <Line
            type="monotone"
            dataKey="netWorth"
            stroke={c.emerald}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, stroke: c.emerald, strokeWidth: 2, fill: '#064e3b' }}
            name="Net Worth"
          />

          <ReferenceLine y={0} stroke={c.tick} strokeDasharray="4 2" opacity={0.6} />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: c.blue }} />
          <span style={{ color: c.textMuted }}>Cash / Savings</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: c.emerald, height: 3 }} />
          <span style={{ color: c.textMuted }}>Net Worth</span>
        </div>
      </div>
    </div>
  )
}
