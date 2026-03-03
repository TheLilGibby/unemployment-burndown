import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { computeAllocationAmount } from '../../utils/stateTaxRates'
import dayjs from 'dayjs'

const ANNUAL_RETURN = 0.07
const MONTHLY_RETURN = Math.pow(1 + ANNUAL_RETURN, 1 / 12) - 1

const ZOOM_OPTIONS = [
  { label: '1Y', months: 12 },
  { label: '2Y', months: 24 },
  { label: '5Y', months: 60 },
  { label: '10Y', months: 120 },
  { label: '20Y', months: 240 },
  { label: '30Y', months: 360 },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="rounded-lg px-3 py-2 text-sm shadow-xl space-y-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d?.dateLabel}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function InvestmentGrowthChart({ scenarios }) {
  const [zoom, setZoom] = useState(120)

  const chartData = useMemo(() => {
    if (!scenarios.length) return []
    const today = dayjs('2026-02-21')
    const dataMap = {}

    for (let m = 0; m <= zoom; m++) {
      const d = today.add(m, 'month')
      dataMap[m] = { month: m, dateLabel: d.format('MMM YYYY') }
    }

    for (const s of scenarios) {
      const baseMonthlyTakeHome = s.monthlyTakeHome
      const raisePct = s.annualRaisePct || 0
      const startOffset = Math.max(0, dayjs(s.startDate).diff(today, 'month'))
      let balance = 0

      const matchPct = s.employer401kMatchPct || 0

      for (let m = 0; m <= zoom; m++) {
        if (m >= startOffset) {
          const monthsSinceStart = m - startOffset
          const fullYears = Math.floor(monthsSinceStart / 12)
          const raiseFactor = raisePct > 0 && fullYears > 0
            ? Math.pow(1 + raisePct / 100, fullYears) : 1
          const currentTakeHome = baseMonthlyTakeHome * raiseFactor
          const monthlyContrib = computeAllocationAmount(s.investmentAllocation, s.investmentAllocationType, currentTakeHome)
          // Employer 401k match: % of gross monthly salary (grows with raises)
          const matchContrib = matchPct > 0
            ? (s.grossAnnualSalary / 12) * raiseFactor * (matchPct / 100) : 0
          balance = balance * (1 + MONTHLY_RETURN) + monthlyContrib + matchContrib
        }
        dataMap[m][s.name] = Math.round(balance)
      }
    }

    return Object.values(dataMap)
  }, [scenarios, zoom])

  if (!scenarios.length) return null

  const step = Math.max(1, Math.ceil(chartData.length / 60))
  const thinned = chartData.filter((_, i) => i % step === 0 || i === chartData.length - 1)

  const allKeys = scenarios.map(s => s.name)
  const maxVal = Math.max(0, ...thinned.map(d => Math.max(...allKeys.map(k => d[k] ?? 0))))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {ZOOM_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => setZoom(opt.months)}
              className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
              style={{
                borderColor: zoom === opt.months ? 'var(--accent-blue)' : 'var(--border-subtle)',
                background: zoom === opt.months ? 'var(--accent-blue)' + '20' : 'transparent',
                color: zoom === opt.months ? 'var(--accent-blue)' : 'var(--text-faint)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>7% annual return assumed</span>
      </div>

      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={thinned} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
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
              width={60}
              domain={[0, maxVal * 1.05]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

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
