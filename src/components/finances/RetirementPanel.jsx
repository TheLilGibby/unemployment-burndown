import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { formatCurrency, formatAxisValue } from '../../utils/formatters'
import { computeRetirementProjection } from '../../utils/retirementProjection'
import CurrencyInput from './CurrencyInput'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'

const ZOOM_OPTIONS = [
  { label: '10Y', months: 120 },
  { label: '20Y', months: 240 },
  { label: '30Y', months: 360 },
  { label: 'All', months: 0 },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-xl space-y-1"
      style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)' }}
    >
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {d?.dateLabel} (age {Math.floor(d?.age ?? 0)})
      </p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function RetirementPanel({ data, onChange, people = [] }) {
  const [zoom, setZoom] = useState(360)

  function update(field, val) {
    onChange({ ...data, [field]: val })
  }

  // Compute effective target nest egg
  const effectiveTarget = data.targetMode === 'income'
    ? Math.round((Number(data.desiredAnnualIncome) || 0) / ((Number(data.withdrawalRatePct) || 4) / 100))
    : Number(data.targetNestEgg) || 0

  // Run projection
  const projection = useMemo(() => computeRetirementProjection({
    currentAge: Number(data.currentAge) || 30,
    targetRetirementAge: Number(data.targetRetirementAge) || 65,
    currentBalance: Number(data.currentBalance) || 0,
    monthlyContribution: Number(data.monthlyContribution) || 0,
    annualReturnPct: Number(data.annualReturnPct) || 7,
    inflationPct: Number(data.inflationPct) || 3,
    targetNestEgg: effectiveTarget,
  }), [data, effectiveTarget])

  // Prepare chart data — thin to ~80 points for performance
  const maxMonths = zoom === 0
    ? projection.dataPoints.length
    : Math.min(zoom, projection.dataPoints.length)
  const rawData = projection.dataPoints.slice(0, maxMonths)
  const step = Math.max(1, Math.ceil(rawData.length / 80))
  const chartData = rawData.filter((_, i) => i % step === 0 || i === rawData.length - 1)

  const yearsToRetirement = Math.max(0, (Number(data.targetRetirementAge) || 65) - (Number(data.currentAge) || 30))
  const retirementMonth = yearsToRetirement * 12
  const retirementDateLabel = chartData.find(d => d.month >= retirementMonth)?.dateLabel

  const onTrack = projection.hitsGoal
  const contributionGap = Math.max(0, projection.monthlyToReachGoal - (Number(data.monthlyContribution) || 0))

  return (
    <div className="space-y-5">
      {/* Input Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Current Age</span>
          <input
            type="number"
            value={data.currentAge}
            min={16}
            max={80}
            onChange={e => update('currentAge', Number(e.target.value) || 0)}
            className="w-full theme-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Retirement Age</span>
          <input
            type="number"
            value={data.targetRetirementAge}
            min={(data.currentAge || 30) + 1}
            max={100}
            onChange={e => update('targetRetirementAge', Number(e.target.value) || 0)}
            className="w-full theme-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Current Retirement Savings</span>
          <div
            className="flex items-center border rounded-lg px-2 py-2 focus-within:border-indigo-500"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-input)' }}
          >
            <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
            <CurrencyInput
              value={data.currentBalance}
              onChange={val => update('currentBalance', val)}
              className="bg-transparent text-sm w-full outline-none"
              style={{ color: 'var(--text-primary)' }}
              min="0"
            />
          </div>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Monthly Contribution</span>
          <div
            className="flex items-center border rounded-lg px-2 py-2 focus-within:border-indigo-500"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-input)' }}
          >
            <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
            <CurrencyInput
              value={data.monthlyContribution}
              onChange={val => update('monthlyContribution', val)}
              className="bg-transparent text-sm w-full outline-none"
              style={{ color: 'var(--text-primary)' }}
              min="0"
            />
            <span className="text-xs ml-1 shrink-0" style={{ color: 'var(--text-faint)' }}>/mo</span>
          </div>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Annual Return %</span>
          <div
            className="flex items-center border rounded-lg px-3 py-2 focus-within:border-indigo-500"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-input)' }}
          >
            <input
              type="number"
              value={data.annualReturnPct}
              min={0}
              max={30}
              step={0.5}
              onChange={e => update('annualReturnPct', Number(e.target.value) || 0)}
              className="bg-transparent text-sm w-full outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>%</span>
          </div>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Inflation %</span>
          <div
            className="flex items-center border rounded-lg px-3 py-2 focus-within:border-indigo-500"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-input)' }}
          >
            <input
              type="number"
              value={data.inflationPct}
              min={0}
              max={20}
              step={0.5}
              onChange={e => update('inflationPct', Number(e.target.value) || 0)}
              className="bg-transparent text-sm w-full outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>%</span>
          </div>
        </label>
      </div>

      {/* Target Mode Toggle */}
      <div
        className="rounded-lg border p-4 space-y-3"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Goal Target
          </span>
          <div className="flex gap-1">
            {['nestEgg', 'income'].map(mode => (
              <button
                key={mode}
                onClick={() => update('targetMode', mode)}
                className="text-xs px-3 py-1 rounded-lg border transition-colors"
                style={{
                  borderColor: data.targetMode === mode ? '#6366f1' : 'var(--border-subtle)',
                  background: data.targetMode === mode ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: data.targetMode === mode ? '#6366f1' : 'var(--text-muted)',
                }}
              >
                {mode === 'nestEgg' ? 'Nest Egg Amount' : 'From Income Goal'}
              </button>
            ))}
          </div>
        </div>

        {data.targetMode === 'nestEgg' ? (
          <label className="space-y-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Target Nest Egg</span>
            <div
              className="flex items-center border rounded-lg px-2 py-2 focus-within:border-indigo-500 max-w-xs"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
            >
              <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
              <CurrencyInput
                value={data.targetNestEgg}
                onChange={val => update('targetNestEgg', val)}
                className="bg-transparent text-sm w-full outline-none"
                style={{ color: 'var(--text-primary)' }}
                min="0"
              />
            </div>
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <label className="space-y-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Desired Annual Income</span>
              <div
                className="flex items-center border rounded-lg px-2 py-2 focus-within:border-indigo-500"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
              >
                <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                <CurrencyInput
                  value={data.desiredAnnualIncome}
                  onChange={val => update('desiredAnnualIncome', val)}
                  className="bg-transparent text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  min="0"
                />
                <span className="text-xs ml-1 shrink-0" style={{ color: 'var(--text-faint)' }}>/yr</span>
              </div>
            </label>
            <label className="space-y-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Withdrawal Rate</span>
              <div
                className="flex items-center border rounded-lg px-3 py-2 focus-within:border-indigo-500"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
              >
                <input
                  type="number"
                  value={data.withdrawalRatePct}
                  min={1}
                  max={10}
                  step={0.5}
                  onChange={e => update('withdrawalRatePct', Number(e.target.value) || 4)}
                  className="bg-transparent text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
                <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
            </label>
            <p className="col-span-2 text-xs" style={{ color: 'var(--text-faint)' }}>
              Implied nest egg: {formatCurrency(effectiveTarget)} (the "{data.withdrawalRatePct || 4}% rule")
            </p>
          </div>
        )}
      </div>

      {/* Assignee + Comment */}
      {people.length > 0 && (
        <div className="flex items-center gap-3">
          <AssigneeSelect
            people={people}
            value={data.assignedTo ?? null}
            onChange={val => update('assignedTo', val)}
          />
          <CommentButton itemId="retirement" label="Retirement Plan" />
        </div>
      )}

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="theme-card rounded-xl border p-3">
          <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Projected</p>
          <p className="text-lg font-bold sensitive" style={{ color: 'var(--accent-blue)' }}>
            {formatCurrency(projection.projectedAtRetirement)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>at age {data.targetRetirementAge}</p>
        </div>

        <div className="theme-card rounded-xl border p-3">
          <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Target</p>
          <p className="text-lg font-bold sensitive" style={{ color: 'var(--text-secondary)' }}>
            {formatCurrency(effectiveTarget)}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {data.targetMode === 'income' ? `${data.withdrawalRatePct}% rule` : 'nest egg'}
          </p>
        </div>

        <div className="theme-card rounded-xl border p-3">
          <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Status</p>
          <p className="text-lg font-bold" style={{
            color: onTrack ? 'var(--accent-emerald)' : 'var(--accent-red)'
          }}>
            {onTrack ? 'On Track' : 'Behind'}
          </p>
          <p className="text-xs sensitive" style={{ color: 'var(--text-faint)' }}>
            {onTrack
              ? `${formatCurrency(projection.surplus)} surplus`
              : `${formatCurrency(projection.shortfall)} shortfall`
            }
          </p>
        </div>

        <div className="theme-card rounded-xl border p-3">
          <p className="text-xs uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Need /mo</p>
          <p className="text-lg font-bold sensitive" style={{
            color: contributionGap > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)'
          }}>
            {formatCurrency(projection.monthlyToReachGoal)}
          </p>
          <p className="text-xs sensitive" style={{ color: 'var(--text-faint)' }}>
            {contributionGap > 0
              ? `+${formatCurrency(contributionGap)} more`
              : "you're covered"
            }
          </p>
        </div>
      </div>

      {/* Projection Chart */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {ZOOM_OPTIONS.map(opt => (
              <button
                key={opt.label}
                onClick={() => setZoom(opt.months)}
                className="text-xs px-2.5 py-1 rounded-lg border transition-colors"
                style={{
                  borderColor: zoom === opt.months ? 'var(--accent-blue)' : 'var(--border-subtle)',
                  background: zoom === opt.months ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: zoom === opt.months ? 'var(--accent-blue)' : 'var(--text-faint)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {data.annualReturnPct}% return, {data.inflationPct}% inflation
          </span>
        </div>

        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatAxisValue}
                tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />

              {/* Target line */}
              <ReferenceLine
                y={effectiveTarget}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{ value: `Target: ${formatCurrency(effectiveTarget)}`, fill: '#f59e0b', fontSize: 11, position: 'right' }}
              />

              {/* Retirement age vertical line */}
              {retirementDateLabel && (
                <ReferenceLine
                  x={retirementDateLabel}
                  stroke="#8b5cf6"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                  label={{ value: `Age ${data.targetRetirementAge}`, fill: '#8b5cf6', fontSize: 11, position: 'top' }}
                />
              )}

              {/* Inflation-adjusted (real) balance — primary */}
              <Area
                type="monotone"
                dataKey="realBalance"
                name="Real (Inflation-Adj.)"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="#6366f1"
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />

              {/* Nominal balance — secondary/dashed */}
              <Area
                type="monotone"
                dataKey="nominalBalance"
                name="Nominal"
                stroke="#3b82f6"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                fill="#3b82f6"
                fillOpacity={0.04}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Real balance adjusts for {data.inflationPct}% annual inflation. The "{data.withdrawalRatePct || 4}% rule"
        means withdrawing {data.withdrawalRatePct || 4}% of your nest egg annually in retirement.
        {yearsToRetirement > 0 && ` ${yearsToRetirement} years until target retirement.`}
      </p>
    </div>
  )
}
