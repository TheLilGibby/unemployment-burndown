import { memo, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const METRIC_OPTIONS = [
  { key: 'income',  label: 'Income' },
  { key: 'outflow', label: 'Spending' },
  { key: 'net',     label: 'Net Cash Flow' },
  { key: 'balance', label: 'Balance' },
]

function YearOverYearChart({ dataPoints }) {
  const [metric, setMetric] = useState('net')
  const c = useChartColors()

  const YEAR_COLORS = [c.blue, c.purple, c.amber, c.emerald, c.red]

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg px-3 py-2 text-sm shadow-xl space-y-1" style={{ background: c.bgCard, border: `1px solid ${c.borderDefault}` }}>
        <p className="text-xs font-semibold" style={{ color: c.textMuted }}>{label}</p>
        {payload.map(p => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span style={{ color: p.color }} className="font-semibold">
              {p.name}: {formatCurrency(p.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const { chartData, years } = useMemo(() => {
    if (!dataPoints?.length) return { chartData: [], years: [] }

    // Group data points by calendar year and month
    const byYearMonth = {}
    const yearSet = new Set()

    for (const pt of dataPoints) {
      if (pt.month <= 0) continue
      const d = pt.date ? new Date(pt.date) : null
      if (!d) continue
      const year = d.getFullYear()
      const monthIdx = d.getMonth()
      yearSet.add(year)

      if (!byYearMonth[monthIdx]) byYearMonth[monthIdx] = {}
      byYearMonth[monthIdx][year] = {
        income: pt.income || 0,
        outflow: Math.max(0, (pt.income || 0) + (pt.netBurn || 0)),
        net: -(pt.netBurn || 0),
        balance: pt.balance || 0,
      }
    }

    const sortedYears = [...yearSet].sort()
    // Keep only last 5 years max
    const displayYears = sortedYears.slice(-5)

    const data = MONTH_NAMES.map((name, idx) => {
      const point = { month: name }
      for (const year of displayYears) {
        const vals = byYearMonth[idx]?.[year]
        if (vals) {
          point[`${year}`] = vals[metric]
        }
      }
      return point
    })

    return { chartData: data, years: displayYears.map(String) }
  }, [dataPoints, metric])

  if (!dataPoints?.length || years.length === 0) return null

  const useBarChart = metric === 'income' || metric === 'outflow'
  const allVals = chartData.flatMap(d => years.map(y => d[y] ?? 0))
  const maxVal = Math.max(0, ...allVals)
  const minVal = Math.min(0, ...allVals)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold" style={{ color: c.textPrimary }}>
          Year-over-Year Comparison
        </h3>
        <div className="flex rounded-md overflow-hidden border" style={{ borderColor: c.borderDefault }}>
          {METRIC_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setMetric(opt.key)}
              className="text-xs px-3 py-1 transition-colors"
              style={{
                background: metric === opt.key ? c.withAlpha(c.blue, '20') : 'var(--bg-input)',
                color: metric === opt.key ? c.blue : c.textFaint,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sensitive-chart" style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={c.borderSubtle} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: c.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={v => {
                const abs = Math.abs(v)
                const sign = v < 0 ? '-' : ''
                if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(1) + 'M'
                if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(0) + 'k'
                return sign + '$' + abs
              }}
              tick={{ fill: c.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={[minVal * 1.1, maxVal * 1.1]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

            {years.map((year, i) =>
              useBarChart ? (
                <Bar
                  key={year}
                  dataKey={year}
                  name={year}
                  fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                  fillOpacity={0.7}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={16}
                />
              ) : (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year}
                  name={year}
                  stroke={YEAR_COLORS[i % YEAR_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: YEAR_COLORS[i % YEAR_COLORS.length] }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default memo(YearOverYearChart)
