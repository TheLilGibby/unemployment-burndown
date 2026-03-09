import { thinChartData, isBurndownCritical } from '../../utils/thinChartData'
import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatAxisValue } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: '5Y', months: 60 },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm shadow-xl space-y-1">
      <p className="text-gray-400 text-xs">{d?.dateLabel}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

/**
 * Merges N scenario dataPoint arrays (by month index) into a single array
 * for a multi-line chart. Includes a baseline (no-job) line.
 */
function mergeDataPoints(baselinePoints, scenarios, scenarioResults, maxMonths) {
  const map = {}
  for (const pt of (baselinePoints || [])) {
    if (pt.month > maxMonths) break
    map[pt.month] = { dateLabel: pt.dateLabel, month: pt.month, 'No Job (Baseline)': pt.balance }
  }
  for (const s of scenarios) {
    const result = scenarioResults[s.id]
    if (!result) continue
    for (const pt of result.dataPoints) {
      if (pt.month > maxMonths) break
      map[pt.month] = { ...map[pt.month], dateLabel: pt.dateLabel, month: pt.month, [s.name]: pt.balance }
    }
  }
  return Object.values(map).sort((a, b) => a.month - b.month)
}

export default function JobScenariosChart({ scenarios, scenarioResults }) {
  const [zoom, setZoom] = useState(24)
  const c = useChartColors()
  const baselineResult = scenarioResults['__baseline__']
  if (!baselineResult || scenarios.length === 0) return null

  const merged = mergeDataPoints(baselineResult.dataPoints, scenarios, scenarioResults, zoom)



  const chartData = thinChartData(merged, 60, isBurndownCritical)

  // Compute max balance for Y axis
  const allKeys = ['No Job (Baseline)', ...scenarios.map(s => s.name)]
  const maxBalance = Math.max(
    ...chartData.map(d => Math.max(...allKeys.map(k => d[k] ?? 0)))
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {ZOOM_OPTIONS.map(opt => (
          <button
            key={opt.label}
            onClick={() => setZoom(opt.months)}
            className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
            style={{
              borderColor: zoom === opt.months ? c.blue : c.borderSubtle,
              background: zoom === opt.months ? c.withAlpha(c.blue, '20') : 'transparent',
              color: zoom === opt.months ? c.blue : c.textFaint,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

    <div className="sensitive-chart" style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.tooltipBorder} vertical={false} />

          <XAxis
            dataKey="dateLabel"
            tick={{ fill: c.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />

          <YAxis
            tickFormatter={formatAxisValue}
            tick={{ fill: c.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={[0, maxBalance * 1.05]}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: c.textSecondary }}>{value}</span>}
          />

          <ReferenceLine y={0} stroke={c.red} strokeDasharray="4 2" strokeWidth={1.5} />

          {/* Baseline (no job) — dashed gray */}
          <Line
            type="monotone"
            dataKey="No Job (Baseline)"
            stroke={c.tick}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />

          {/* One solid line per scenario */}
          {scenarios.map(s => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
    </div>
  )
}
