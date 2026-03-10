import { thinChartData } from '../../utils/thinChartData'
import { memo, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '6M',  months: 6        },
  { label: '1Y',  months: 12       },
  { label: '2Y',  months: 24       },
  { label: 'All', months: Infinity },
]

function CustomTooltip({ active, payload }) {
  const c = useChartColors()
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const burning = d.netBurn > 0
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-sm shadow-2xl min-w-[170px]"
      style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}` }}
    >
      <p className="text-xs font-semibold mb-1.5" style={{ color: c.textSecondary }}>{d.dateLabel}</p>
      <p className="font-bold" style={{ color: burning ? c.red : c.emerald }}>
        {burning ? '−' : '+'}{formatCurrency(Math.abs(d.netBurn))}<span className="text-xs font-normal opacity-70">/mo</span>
      </p>
      <p className="text-xs mt-1" style={{ color: c.tick }}>
        {burning ? 'drawing down savings' : 'income exceeds expenses'}
      </p>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {d.inBenefitWindow && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: c.withAlpha(c.emerald, 0.2), color: c.emerald }}>UI active</span>
        )}
        {d.jobActive && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: c.withAlpha(c.blue, 0.2), color: c.blue }}>Employed</span>
        )}
        {d.oneTimeCost && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: c.withAlpha(c.orange, 0.2), color: c.orange }}>Big expense</span>
        )}
      </div>
    </div>
  )
}

function BurnRateChart({ dataPoints }) {
  const c = useChartColors()
  const [zoom, setZoom] = useState('2Y')
  const zoomMonths = ZOOM_OPTIONS.find(z => z.label === zoom)?.months ?? Infinity

  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return []
    const filtered = dataPoints.filter(pt => pt.month > 0 && pt.month <= zoomMonths)
    // Thin data while preserving critical event points

    return thinChartData(filtered, 60)
  }, [dataPoints, zoomMonths])

  const maxAbs = Math.max(...chartData.map(d => Math.abs(d.netBurn)), 1)

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 260, color: c.tick }}
      >
        No burn rate data to display yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Legend + zoom */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs" style={{ color: c.tick }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c.withAlpha(c.red, 'bb') }} />
            Burning savings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c.withAlpha(c.emerald, 'bb') }} />
            Positive cash flow
          </span>
        </div>
        <div className="flex gap-1">
          {ZOOM_OPTIONS.map(z => (
            <button
              key={z.label}
              onClick={() => setZoom(z.label)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                zoom === z.label
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sensitive-chart" style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: c.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={v => {
                const a = Math.abs(v)
                const s = a >= 1000 ? (a / 1000).toFixed(0) + 'k' : a
                return (v > 0 ? '−' : v < 0 ? '+' : '') + '$' + s
              }}
              tick={{ fill: c.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={[-maxAbs * 1.15, maxAbs * 1.15]}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke={c.tooltipBorder} strokeWidth={1.5} />
            <Bar dataKey="netBurn" radius={[2, 2, 0, 0]} maxBarSize={22}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.netBurn > 0 ? c.withAlpha(c.red, 'bb') : c.withAlpha(c.emerald, 'bb')} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default memo(BurnRateChart)
