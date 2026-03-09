import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { formatCurrency, formatAxisValue } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function CustomTooltip({ active, payload, label, colors }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-sm shadow-xl space-y-1" style={{ background: colors.bgCard, border: `1px solid ${colors.borderDefault}` }}>
      <p className="text-xs font-semibold" style={{ color: colors.textMuted }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill || p.color || p.stroke }} />
          <span style={{ color: p.fill || p.color || p.stroke }} className="font-semibold">
            {p.name}: {formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function SpendingPatternsChart({ dataPoints }) {
  const c = useChartColors()
  const [view, setView] = useState('trend') // 'trend' | 'anomaly'

  const { trendData, anomalyData, avgSpend } = useMemo(() => {
    if (!dataPoints?.length) return { trendData: [], anomalyData: [], avgSpend: 0 }

    // Build monthly spend timeline
    const monthlySpend = dataPoints
      .filter(pt => pt.month > 0)
      .map(pt => {
        const income = pt.income || 0
        const netBurn = pt.netBurn || 0
        const spend = Math.max(0, income + netBurn)
        return {
          ...pt,
          spend,
        }
      })

    // Moving average (3-month window)
    const withMA = monthlySpend.map((pt, i) => {
      const window = monthlySpend.slice(Math.max(0, i - 2), i + 1)
      const ma = window.reduce((s, d) => s + d.spend, 0) / window.length
      return { ...pt, movingAvg: Math.round(ma) }
    })

    // Thin to 48 points max
    const MAX = 48
    const step = Math.max(1, Math.ceil(withMA.length / MAX))
    const trend = withMA.filter((_, i) => i % step === 0 || i === withMA.length - 1)

    // Average spending
    const totalSpend = monthlySpend.reduce((s, d) => s + d.spend, 0)
    const avg = monthlySpend.length > 0 ? totalSpend / monthlySpend.length : 0

    // Anomaly detection: months > 1.5 std devs from mean
    const mean = avg
    const variance = monthlySpend.reduce((s, d) => s + Math.pow(d.spend - mean, 2), 0) / Math.max(1, monthlySpend.length)
    const stdDev = Math.sqrt(variance)
    const threshold = 1.5

    const anomalies = monthlySpend
      .map(pt => {
        const deviation = (pt.spend - mean) / (stdDev || 1)
        const isAnomaly = Math.abs(deviation) > threshold
        return {
          ...pt,
          deviation: Math.round(deviation * 100) / 100,
          isAnomaly,
          isHigh: isAnomaly && deviation > 0,
          isLow: isAnomaly && deviation < 0,
          avgLine: Math.round(mean),
          upperBound: Math.round(mean + stdDev * threshold),
          lowerBound: Math.round(Math.max(0, mean - stdDev * threshold)),
        }
      })
      .filter((_, i) => i % step === 0 || i === monthlySpend.length - 1)

    return { trendData: trend, anomalyData: anomalies, avgSpend: Math.round(avg) }
  }, [dataPoints])

  if (!dataPoints?.length) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold" style={{ color: c.textPrimary }}>
          Spending Patterns
        </h3>
        <div className="flex rounded-md overflow-hidden border" style={{ borderColor: c.borderDefault }}>
          <button
            onClick={() => setView('trend')}
            className="text-xs px-3 py-1 transition-colors"
            style={{
              background: view === 'trend' ? c.withAlpha(c.blue, '20') : 'var(--bg-input)',
              color: view === 'trend' ? c.blue : c.textFaint,
            }}
          >
            Trend
          </button>
          <button
            onClick={() => setView('anomaly')}
            className="text-xs px-3 py-1 transition-colors"
            style={{
              background: view === 'anomaly' ? c.withAlpha(c.amber, '20') : 'var(--bg-input)',
              color: view === 'anomaly' ? c.amber : c.textFaint,
            }}
          >
            Anomalies
          </button>
        </div>
      </div>

      {view === 'trend' && (
        <div className="sensitive-chart" style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={c.borderSubtle} vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: c.textMuted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatAxisValue}
                tick={{ fill: c.textMuted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip colors={c} />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

              <ReferenceLine
                y={avgSpend}
                stroke={c.tick}
                strokeDasharray="4 2"
                strokeWidth={1.5}
                label={{ value: `Avg: ${formatCurrency(avgSpend)}`, fill: c.tick, fontSize: 10, position: 'right' }}
              />

              <Bar
                dataKey="spend"
                name="Monthly Spend"
                fill={c.orange}
                fillOpacity={0.5}
                radius={[2, 2, 0, 0]}
                maxBarSize={14}
              />
              <Line
                type="monotone"
                dataKey="movingAvg"
                name="3-mo Avg"
                stroke={c.blue}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'anomaly' && (
        <>
          <div className="sensitive-chart" style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={anomalyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={c.borderSubtle} vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: c.textMuted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatAxisValue}
                  tick={{ fill: c.textMuted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip content={<CustomTooltip colors={c} />} />

                <ReferenceLine y={avgSpend} stroke={c.tick} strokeDasharray="4 2" strokeWidth={1.5} />

                <Bar dataKey="spend" name="Monthly Spend" maxBarSize={14} radius={[2, 2, 0, 0]}>
                  {anomalyData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isHigh ? c.red : entry.isLow ? c.emerald : c.withAlpha(c.tick, '80')}
                      fillOpacity={entry.isAnomaly ? 0.8 : 0.4}
                    />
                  ))}
                </Bar>

                <Line
                  type="monotone"
                  dataKey="upperBound"
                  name="Upper Bound"
                  stroke={c.withAlpha(c.red, '80')}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="lowerBound"
                  name="Lower Bound"
                  stroke={c.withAlpha(c.emerald, '80')}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Anomaly summary */}
          {anomalyData.some(d => d.isAnomaly) && (
            <div className="space-y-1">
              <p className="text-xs font-medium" style={{ color: c.textMuted }}>Anomalous months:</p>
              <div className="flex flex-wrap gap-1.5">
                {anomalyData.filter(d => d.isAnomaly).map((d, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: d.isHigh ? c.withAlpha(c.red, '20') : c.withAlpha(c.emerald, '20'),
                      color: d.isHigh ? c.red : c.emerald,
                    }}
                  >
                    {d.dateLabel}: {formatCurrency(d.spend)} ({d.deviation > 0 ? '+' : ''}{d.deviation}σ)
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
