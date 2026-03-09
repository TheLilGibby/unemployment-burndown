import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { computeMonthlyTakeHome } from '../../utils/stateTaxRates'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '1Y', years: 1 },
  { label: '2Y', years: 2 },
  { label: '5Y', years: 5 },
  { label: '10Y', years: 10 },
  { label: '20Y', years: 20 },
]

export default function SalaryGrowthChart({ scenarios, effectiveExpenses = 0 }) {
  const c = useChartColors()
  const [zoom, setZoom] = useState(5)
  const [mode, setMode] = useState('gross') // 'gross' | 'takeHome' | 'totalComp'

  function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="rounded-lg px-3 py-2 text-sm shadow-xl space-y-1" style={{ background: c.bgCard, border: `1px solid ${c.borderDefault}` }}>
        <p className="text-xs font-semibold" style={{ color: c.textMuted }}>Year {d?.year}</p>
        {payload.map(p => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span style={{ color: p.color }} className="font-semibold">
              {p.name}: {formatCurrency(p.value)}/yr
            </span>
          </div>
        ))}
      </div>
    )
  }

  const chartData = useMemo(() => {
    if (!scenarios.length) return []
    const data = []

    for (let y = 0; y <= zoom; y++) {
      const point = { year: y, yearLabel: `Year ${y}` }
      for (const s of scenarios) {
        const raisePct = s.annualRaisePct || 0
        const raiseFactor = y > 0 && raisePct > 0
          ? Math.pow(1 + raisePct / 100, y)
          : 1
        const projectedGross = s.grossAnnualSalary * raiseFactor

        if (mode === 'gross') {
          point[s.name] = Math.round(projectedGross)
        } else if (mode === 'totalComp') {
          const bonusGross = projectedGross * (s.annualBonusPct || 0) / 100
          const equity = s.equityAnnual || 0
          const signing = y === 0 ? (s.signingBonus || 0) : 0
          point[s.name] = Math.round(projectedGross + bonusGross + equity + signing)
        } else {
          point[s.name] = Math.round(computeMonthlyTakeHome(projectedGross, s.taxRatePct) * 12)
        }
      }

      // Add expense line for reference
      if (effectiveExpenses > 0 && mode === 'takeHome') {
        point['Annual Expenses'] = Math.round(effectiveExpenses * 12)
      }

      data.push(point)
    }
    return data
  }, [scenarios, zoom, mode, effectiveExpenses])

  if (!scenarios.length) return null

  const allKeys = scenarios.map(s => s.name)
  const maxVal = Math.max(0, ...chartData.map(d => Math.max(...allKeys.map(k => d[k] ?? 0))))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {ZOOM_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => setZoom(opt.years)}
              className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
              style={{
                borderColor: zoom === opt.years ? c.blue : c.borderSubtle,
                background: zoom === opt.years ? c.withAlpha(c.blue, '20') : 'transparent',
                color: zoom === opt.years ? c.blue : c.textFaint,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-md overflow-hidden border" style={{ borderColor: c.borderDefault }}>
          <button
            onClick={() => setMode('gross')}
            className="text-xs px-3 py-1 transition-colors"
            style={{
              background: mode === 'gross' ? c.withAlpha(c.blue, '20') : 'var(--bg-input)',
              color: mode === 'gross' ? c.blue : c.textFaint,
            }}
          >
            Gross
          </button>
          <button
            onClick={() => setMode('takeHome')}
            className="text-xs px-3 py-1 transition-colors"
            style={{
              background: mode === 'takeHome' ? c.withAlpha(c.emerald, '20') : 'var(--bg-input)',
              color: mode === 'takeHome' ? c.emerald : c.textFaint,
            }}
          >
            Take-Home
          </button>
          <button
            onClick={() => setMode('totalComp')}
            className="text-xs px-3 py-1 transition-colors"
            style={{
              background: mode === 'totalComp' ? c.withAlpha(c.purple, '20') : 'var(--bg-input)',
              color: mode === 'totalComp' ? c.purple : c.textFaint,
            }}
          >
            Total Comp
          </button>
        </div>
      </div>

      <div className="sensitive-chart" style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.borderSubtle} vertical={false} />
            <XAxis
              dataKey="yearLabel"
              tick={{ fill: c.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={v => {
                if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M'
                if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'k'
                return '$' + v
              }}
              tick={{ fill: c.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={60}
              domain={[0, maxVal * 1.1]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

            {/* Expense reference line when in take-home mode */}
            {mode === 'takeHome' && effectiveExpenses > 0 && (
              <Line
                type="monotone"
                dataKey="Annual Expenses"
                stroke={c.red}
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
              />
            )}

            {scenarios.map(s => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Quick stats table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: c.textMuted }}>
              <th className="text-left py-1 pr-3 font-medium">Scenario</th>
              <th className="text-right py-1 px-2 font-medium">Raise</th>
              <th className="text-right py-1 px-2 font-medium">Year 1</th>
              <th className="text-right py-1 px-2 font-medium">Year 2</th>
              {zoom >= 5 && <th className="text-right py-1 px-2 font-medium">Year 5</th>}
              {zoom >= 10 && <th className="text-right py-1 px-2 font-medium">Year 10</th>}
              <th className="text-right py-1 pl-2 font-medium">Total Earned ({zoom}yr)</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map(s => {
              const r = (s.annualRaisePct || 0) / 100
              const g = s.grossAnnualSalary
              const bonusPct = (s.annualBonusPct || 0) / 100
              const equity = s.equityAnnual || 0
              const signing = s.signingBonus || 0
              const yrBase = (y) => g * Math.pow(1 + r, y)
              const yr = mode === 'totalComp'
                ? (y) => yrBase(y) + yrBase(y) * bonusPct + equity + (y === 0 ? signing : 0)
                : yrBase
              // Total earnings over zoom years = sum of geometric series
              const baseEarned = r > 0
                ? g * (Math.pow(1 + r, zoom) - 1) / r
                : g * zoom
              const totalEarned = mode === 'totalComp'
                ? baseEarned + baseEarned * bonusPct + equity * zoom + signing
                : baseEarned

              return (
                <tr key={s.id} className="border-t" style={{ borderColor: c.borderSubtle }}>
                  <td className="py-1.5 pr-3 font-medium" style={{ color: s.color }}>
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: s.color }} />
                    {s.name}
                  </td>
                  <td className="text-right py-1.5 px-2" style={{ color: c.textSecondary }}>
                    {s.annualRaisePct ?? 0}%
                  </td>
                  <td className="text-right py-1.5 px-2" style={{ color: c.textPrimary }}>
                    {formatCurrency(yr(1))}
                  </td>
                  <td className="text-right py-1.5 px-2" style={{ color: c.textPrimary }}>
                    {formatCurrency(yr(2))}
                  </td>
                  {zoom >= 5 && (
                    <td className="text-right py-1.5 px-2" style={{ color: c.textPrimary }}>
                      {formatCurrency(yr(5))}
                    </td>
                  )}
                  {zoom >= 10 && (
                    <td className="text-right py-1.5 px-2" style={{ color: c.textPrimary }}>
                      {formatCurrency(yr(10))}
                    </td>
                  )}
                  <td className="text-right py-1.5 pl-2 font-semibold" style={{ color: c.emerald }}>
                    {formatCurrency(totalEarned)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
