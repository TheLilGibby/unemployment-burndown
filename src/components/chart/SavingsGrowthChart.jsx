import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: '5Y', months: 60 },
  { label: '10Y', months: 120 },
]

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

export default function SavingsGrowthChart({ scenarios, scenarioResults }) {
  const [zoom, setZoom] = useState(60)
  const c = useChartColors()

  function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="rounded-lg px-3 py-2 text-sm shadow-xl space-y-1" style={{ background: c.bgCard, border: `1px solid ${c.borderDefault}` }}>
        <p className="text-xs" style={{ color: c.textMuted }}>{d?.dateLabel}</p>
        {payload.map(p => (
          <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    )
  }
  const baselineResult = scenarioResults['__baseline__']
  if (!baselineResult || scenarios.length === 0) return null

  const merged = mergeDataPoints(baselineResult.dataPoints, scenarios, scenarioResults, zoom)

  const step = Math.max(1, Math.ceil(merged.length / 60))
  const chartData = merged.filter((_, i) => i % step === 0 || i === merged.length - 1)

  const allKeys = ['No Job (Baseline)', ...scenarios.map(s => s.name)]
  const maxBalance = Math.max(0, ...chartData.map(d => Math.max(...allKeys.map(k => d[k] ?? 0))))

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
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.borderSubtle} vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: c.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
              tick={{ fill: c.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
              domain={[0, maxBalance * 1.05]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <ReferenceLine y={0} stroke={c.red} strokeDasharray="4 2" strokeWidth={1.5} />

            {/* Year markers */}
            {[12, 24, 36, 48, 60, 72, 84, 96, 108, 120].filter(m => m <= zoom).map(m => (
              <ReferenceLine key={m} x={chartData.find(d => d.month === m)?.dateLabel} stroke={c.borderSubtle} strokeDasharray="2 4" />
            ))}

            {/* Baseline */}
            <Area
              type="monotone"
              dataKey="No Job (Baseline)"
              stroke={c.tick}
              strokeWidth={2}
              strokeDasharray="6 3"
              fill={c.tick}
              fillOpacity={0.05}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />

            {/* Scenario lines */}
            {scenarios.map(s => (
              <Area
                key={s.id}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2.5}
                fill={s.color}
                fillOpacity={0.08}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
