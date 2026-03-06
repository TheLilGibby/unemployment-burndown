import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { computeAllocationAmount } from '../../utils/stateTaxRates'

function buildWaterfallData(scenario) {
  const monthlyGross = (scenario.grossAnnualSalary || 0) / 12
  const taxes = monthlyGross - scenario.monthlyTakeHome
  const savings = computeAllocationAmount(scenario.savingsAllocation, scenario.savingsAllocationType, scenario.monthlyTakeHome)
  const invest = computeAllocationAmount(scenario.investmentAllocation, scenario.investmentAllocationType, scenario.monthlyTakeHome)
  const equityMonthly = (scenario.equityAnnual || 0) / 12
  const bonusMonthly = scenario.grossAnnualSalary * (scenario.annualBonusPct || 0) / 100 * (1 - scenario.taxRatePct / 100) / 12
  const benefitsOffset = scenario.employerBenefitsMonthly || 0
  const commute = scenario.commuteMonthly || 0

  const bars = []
  let running = monthlyGross
  bars.push({ label: 'Gross', value: monthlyGross, base: 0, fill: '#3b82f6' })
  running -= taxes
  bars.push({ label: 'Taxes', value: taxes, base: running, fill: '#ef4444' })
  if (equityMonthly > 0) {
    bars.push({ label: 'Equity', value: equityMonthly, base: running, fill: '#06b6d4' })
    running += equityMonthly
  }
  if (bonusMonthly > 0) {
    bars.push({ label: 'Bonus', value: bonusMonthly, base: running, fill: '#f59e0b' })
    running += bonusMonthly
  }
  running -= savings
  bars.push({ label: 'Savings', value: savings, base: running, fill: '#f59e0b' })
  running -= invest
  bars.push({ label: 'Invest', value: invest, base: running, fill: '#a855f7' })
  // Adjusted spending: take-home + extra income - allocations + benefits offset - commute
  const spending = scenario.monthlyTakeHome + equityMonthly + bonusMonthly - savings - invest + benefitsOffset - commute
  if (benefitsOffset > 0) {
    bars.push({ label: 'Benefits', value: benefitsOffset, base: running, fill: '#10b981' })
  }
  if (commute > 0) {
    running -= commute
    bars.push({ label: 'Commute', value: commute, base: running, fill: '#ef4444' })
  }
  bars.push({ label: 'Spending', value: Math.max(0, spending), base: 0, fill: '#10b981' })

  return bars
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="rounded-lg px-3 py-2 text-sm shadow-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>{d.label}</p>
      <p style={{ color: d.fill }} className="font-semibold">{formatCurrency(d.value)}/mo</p>
    </div>
  )
}

export default function WaterfallChart({ scenarios }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  if (!scenarios.length) return null

  const scenario = scenarios[selectedIdx] || scenarios[0]
  const data = buildWaterfallData(scenario)

  return (
    <div className="space-y-3">
      {scenarios.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {scenarios.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedIdx(i)}
              className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
              style={{
                borderColor: selectedIdx === i ? s.color : 'var(--border-subtle)',
                background: selectedIdx === i ? s.color + '20' : 'transparent',
                color: selectedIdx === i ? s.color : 'var(--text-faint)',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="sensitive-chart" style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <ReferenceLine y={0} stroke="var(--border-default)" />

            {/* Invisible base bar */}
            <Bar dataKey="base" stackId="stack" fill="transparent" isAnimationActive={false} />
            {/* Visible value bar */}
            <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
