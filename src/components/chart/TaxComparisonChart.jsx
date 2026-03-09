import { memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { formatCurrency, formatAxisValue } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

function TaxComparisonChart({ scenarios }) {
  const c = useChartColors()

  if (!scenarios.length) return null

  const data = scenarios.map(s => ({
    name: s.name,
    takeHome: s.monthlyTakeHome * 12,
    taxes: s.grossAnnualSalary * (s.taxRatePct / 100),
    color: s.color,
  }))

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg px-3 py-2 text-sm shadow-xl space-y-1" style={{ background: c.bgCard, border: `1px solid ${c.borderDefault}` }}>
        <p className="text-xs font-semibold" style={{ color: c.textPrimary }}>{label}</p>
        {payload.map(p => (
          <p key={p.dataKey} style={{ color: p.fill || p.color }} className="font-semibold">
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="sensitive-chart" style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: c.textMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={formatAxisValue}
            tick={{ fill: c.textMuted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

          <Bar dataKey="takeHome" name="Take-Home" stackId="stack" radius={[0, 0, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} fillOpacity={0.7} />
            ))}
          </Bar>
          <Bar dataKey="taxes" name="Taxes" stackId="stack" radius={[4, 4, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={c.red} fillOpacity={0.6} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default memo(TaxComparisonChart)
