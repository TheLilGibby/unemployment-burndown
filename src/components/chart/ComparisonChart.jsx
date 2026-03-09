import { thinChartData, isBurndownCritical } from '../../utils/thinChartData'
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

function CustomTooltip({ active, payload, c }) {
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
 * Merges two dataPoint arrays (by month index) into a single array
 * suitable for a multi-line chart.
 */
function mergeDataPoints(pointsA, pointsB, labelA, labelB) {
  const map = {}
  for (const pt of (pointsA || [])) {
    map[pt.month] = { ...map[pt.month], dateLabel: pt.dateLabel, month: pt.month, [labelA]: pt.balance }
  }
  for (const pt of (pointsB || [])) {
    map[pt.month] = { ...map[pt.month], dateLabel: pt.dateLabel, month: pt.month, [labelB]: pt.balance }
  }
  return Object.values(map).sort((a, b) => a.month - b.month)
}

export default function ComparisonChart({ scenarioA, scenarioB }) {
  const c = useChartColors()

  if (!scenarioA || !scenarioB) return (
    <div
      className="flex items-center justify-center text-sm"
      style={{ height: 260, color: c.tick }}
    >
      Select two scenarios to compare.
    </div>
  )

  const labelA = scenarioA.label || 'Scenario A'
  const labelB = scenarioB.label || 'Scenario B'

  const merged = mergeDataPoints(scenarioA.dataPoints, scenarioB.dataPoints, labelA, labelB)




  const chartData = thinChartData(merged, 60, isBurndownCritical)

  const maxBalance = Math.max(
    ...chartData.map(d => Math.max(d[labelA] ?? 0, d[labelB] ?? 0))
  )

  return (
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

          <Tooltip content={<CustomTooltip c={c} />} />

          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: c.textSecondary }}>{value}</span>}
          />

          <ReferenceLine y={0} stroke={c.red} strokeDasharray="4 2" strokeWidth={1.5} />
          <ReferenceLine
            x="Feb 2026"
            stroke={c.amber}
            strokeDasharray="4 2"
            strokeWidth={1.5}
            label={{ value: 'Today', fill: c.amber, fontSize: 11, position: 'top' }}
          />

          <Line
            type="monotone"
            dataKey={labelA}
            stroke={c.blue}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey={labelB}
            stroke={c.purple}
            strokeWidth={2.5}
            dot={false}
            strokeDasharray="6 3"
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
