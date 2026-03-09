import { memo, useState, useMemo } from 'react'
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
  Legend,
} from 'recharts'
import { formatCurrency, formatAxisValue } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '6M',  months: 6  },
  { label: '1Y',  months: 12 },
  { label: '2Y',  months: 24 },
  { label: 'All', months: Infinity },
]

function CustomTooltip({ active, payload, colors }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-sm shadow-2xl min-w-[200px]">
      <p className="text-gray-400 text-xs mb-2 font-semibold uppercase tracking-wide">{d.dateLabel}</p>

      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-400 text-xs">Cash / Savings</span>
        <span className="text-blue-300 font-bold">{formatCurrency(d.balance)}</span>
      </div>

      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-400 text-xs">Credit Card Debt</span>
        <span className="text-red-400 font-bold">
          {d.totalDebt > 0 ? `−${formatCurrency(d.totalDebt)}` : formatCurrency(0)}
        </span>
      </div>

      <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-700">
        <span className="text-gray-400 text-xs font-semibold">Net Position</span>
        <span
          className="font-bold"
          style={{ color: d.netPosition >= 0 ? colors.emerald : colors.red }}
        >
          {d.netPosition >= 0 ? formatCurrency(d.netPosition) : `−${formatCurrency(Math.abs(d.netPosition))}`}
        </span>
      </div>
    </div>
  )
}

function NetPositionChart({ dataPoints }) {
  const [zoom, setZoom] = useState(12)
  const c = useChartColors()

  const data = useMemo(() => {
    if (zoom === Infinity) return dataPoints
    return dataPoints.slice(0, zoom + 1)
  }, [dataPoints, zoom])

  const hasDebt = data.some(d => d.totalDebt > 0)

  // Compute domain
  const allValues = data.flatMap(d => [d.balance, d.netPosition, hasDebt ? -d.totalDebt : 0])
  const maxVal = Math.max(...allValues, 0)
  const minVal = Math.min(...allValues, 0)

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 260, color: c.tick }}
      >
        No net position data to display yet.
      </div>
    )
  }

  return (
    <div>
      {/* Zoom controls */}
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

      <div className="sensitive-chart">
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={c.blue} stopOpacity={0.3} />
              <stop offset="95%" stopColor={c.blue} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="debtGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="5%" stopColor={c.red} stopOpacity={0.3} />
              <stop offset="95%" stopColor={c.red} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={c.emerald} stopOpacity={0.15} />
              <stop offset="95%" stopColor={c.emerald} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={c.tooltipBorder} opacity={0.4} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: c.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: c.tooltipBorder }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: c.tick, fontSize: 11 }}
            tickFormatter={formatAxisValue}
            tickLine={false}
            axisLine={false}
            domain={[minVal < 0 ? minVal * 1.1 : 0, maxVal * 1.05]}
          />
          <Tooltip content={<CustomTooltip colors={c} />} />

          {/* Cash/savings area */}
          <Area
            type="monotone"
            dataKey="balance"
            stroke={c.blue}
            strokeWidth={2}
            fill="url(#cashGradient)"
            name="Cash / Savings"
            dot={false}
            activeDot={{ r: 4, stroke: c.blue, strokeWidth: 2, fill: '#1e3a5f' }}
          />

          {/* Debt area (shown as negative) */}
          {hasDebt && (
            <Area
              type="monotone"
              dataKey={d => d.totalDebt > 0 ? -d.totalDebt : 0}
              stroke={c.red}
              strokeWidth={1.5}
              fill="url(#debtGradient)"
              name="Credit Card Debt"
              dot={false}
              activeDot={{ r: 4, stroke: c.red, strokeWidth: 2, fill: '#5f1e1e' }}
            />
          )}

          {/* Net position line */}
          <Line
            type="monotone"
            dataKey="netPosition"
            stroke={c.emerald}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, stroke: c.emerald, strokeWidth: 2, fill: '#064e3b' }}
            name="Net Position"
          />

          {/* Zero line */}
          <ReferenceLine y={0} stroke={c.tick} strokeDasharray="4 2" opacity={0.6} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: c.blue }} />
          <span style={{ color: 'var(--text-muted)' }}>Cash / Savings</span>
        </div>
        {hasDebt && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: c.red }} />
            <span style={{ color: 'var(--text-muted)' }}>Credit Card Debt</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: c.emerald, height: 3 }} />
          <span style={{ color: 'var(--text-muted)' }}>Net Position</span>
        </div>
      </div>
    </div>
  )
}

export default memo(NetPositionChart)
