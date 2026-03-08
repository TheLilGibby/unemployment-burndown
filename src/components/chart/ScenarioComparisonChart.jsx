import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { formatCurrency, formatMonths } from '../../utils/formatters'

const METRICS = [
  { key: 'runway',          label: 'Runway (months)',  format: v => formatMonths(v) },
  { key: 'netBurn',         label: 'Net Burn / mo',    format: v => formatCurrency(v) },
  { key: 'balanceAt6',      label: 'Balance @ 6mo',    format: v => formatCurrency(v) },
  { key: 'balanceAt12',     label: 'Balance @ 12mo',   format: v => formatCurrency(v) },
  { key: 'balanceAt24',     label: 'Balance @ 24mo',   format: v => formatCurrency(v) },
  { key: 'peakBalance',     label: 'Peak Balance',     format: v => formatCurrency(v) },
]

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-sm shadow-xl space-y-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill || p.color }} />
          <span style={{ color: p.fill || p.color }} className="font-semibold">
            {p.name}: {formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function computeScenarioMetrics(result) {
  if (!result?.dataPoints?.length) return null
  const pts = result.dataPoints
  return {
    runway: result.totalRunwayMonths || pts.length,
    netBurn: pts[1]?.netBurn || 0,
    balanceAt6: pts.find(p => p.month === 6)?.balance ?? 0,
    balanceAt12: pts.find(p => p.month === 12)?.balance ?? 0,
    balanceAt24: pts.find(p => p.month === 24)?.balance ?? 0,
    peakBalance: Math.max(...pts.map(p => p.balance ?? 0)),
  }
}

export default function ScenarioComparisonChart({ scenarios, scenarioResults }) {
  const [view, setView] = useState('bar') // 'bar' | 'radar' | 'table'

  const { barData, radarData, scenarioMetrics } = useMemo(() => {
    if (!scenarios?.length || !scenarioResults) return { barData: [], radarData: [], scenarioMetrics: [] }

    const baseResult = scenarioResults['__baseline__']
    const allScenarios = [
      { id: '__baseline__', name: 'No Job (Baseline)', color: '#6b7280', result: baseResult },
      ...scenarios.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        result: scenarioResults[s.id],
      })),
    ].filter(s => s.result)

    const metrics = allScenarios.map(s => ({
      ...s,
      metrics: computeScenarioMetrics(s.result),
    })).filter(s => s.metrics)

    // Bar chart data: one group per metric, one bar per scenario
    const bar = METRICS.map(m => {
      const point = { metric: m.label }
      for (const s of metrics) {
        point[s.name] = Math.abs(s.metrics[m.key])
      }
      return point
    })

    // Radar chart data: normalize each metric 0-100 for comparison
    const radar = METRICS.map(m => {
      const vals = metrics.map(s => s.metrics[m.key])
      const max = Math.max(1, ...vals.map(Math.abs))
      const point = { metric: m.label }
      for (const s of metrics) {
        // For netBurn, lower is better, so invert
        const raw = s.metrics[m.key]
        point[s.name] = m.key === 'netBurn'
          ? Math.round((1 - Math.abs(raw) / max) * 100)
          : Math.round((raw / max) * 100)
      }
      return point
    })

    return { barData: bar, radarData: radar, scenarioMetrics: metrics }
  }, [scenarios, scenarioResults])

  if (!scenarioMetrics.length) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">Add job scenarios on the Job Scenarios page to see comparisons here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Scenario Comparison
        </h3>
        <div className="flex rounded-md overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
          {[
            { key: 'bar', label: 'Chart' },
            { key: 'radar', label: 'Radar' },
            { key: 'table', label: 'Table' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setView(opt.key)}
              className="text-xs px-3 py-1 transition-colors"
              style={{
                background: view === opt.key ? 'var(--accent-blue)' + '20' : 'var(--bg-input)',
                color: view === opt.key ? 'var(--accent-blue)' : 'var(--text-faint)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'bar' && (
        <div className="sensitive-chart" style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="metric"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tickFormatter={v => {
                  if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M'
                  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'k'
                  return '$' + v
                }}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {scenarioMetrics.map(s => (
                <Bar key={s.id} dataKey={s.name} fill={s.color} fillOpacity={0.75} radius={[2, 2, 0, 0]} maxBarSize={20} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'radar' && (
        <div className="sensitive-chart" style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: 'var(--text-faint)', fontSize: 9 }}
              />
              {scenarioMetrics.map(s => (
                <Radar
                  key={s.id}
                  name={s.name}
                  dataKey={s.name}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {view === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="text-left py-1.5 pr-3 font-medium">Scenario</th>
                {METRICS.map(m => (
                  <th key={m.key} className="text-right py-1.5 px-2 font-medium">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarioMetrics.map(s => (
                <tr key={s.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="py-1.5 pr-3 font-medium" style={{ color: s.color }}>
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: s.color }} />
                    {s.name}
                  </td>
                  {METRICS.map(m => (
                    <td key={m.key} className="text-right py-1.5 px-2" style={{ color: 'var(--text-primary)' }}>
                      {m.format(s.metrics[m.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
