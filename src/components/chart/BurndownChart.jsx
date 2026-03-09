import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

// ─── Zoom windows ────────────────────────────────────────────────────────────
const ZOOM_OPTIONS = [
  { label: '6M',  months: 6  },
  { label: '1Y',  months: 12 },
  { label: '2Y',  months: 24 },
  { label: 'All', months: Infinity },
]

// ─── Colour helpers ───────────────────────────────────────────────────────────
function zoneColor(balance, maxBalance, c) {
  if (maxBalance <= 0) return c.emerald
  const pct = balance / maxBalance
  if (pct > 0.5) return c.emerald   // green  >50%
  if (pct > 0.25) return c.amber    // yellow 25-50%
  return c.red                       // red    <25%
}

// ─── Rich tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, emergencyFloor, hasBaseline, c }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  const burn = d.netBurn
  const burnColor = burn > 0 ? c.red : c.emerald
  const burnLabel = burn > 0 ? `−${formatCurrency(burn)}/mo` : `+${formatCurrency(Math.abs(burn))}/mo`

  const burnEssential = d.netBurnEssentialOnly
  const burnEssentialColor = burnEssential > 0 ? c.red : c.emerald
  const burnEssentialLabel = burnEssential > 0
    ? `−${formatCurrency(burnEssential)}/mo`
    : `+${formatCurrency(Math.abs(burnEssential))}/mo`

  return (
    <div className="bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-sm shadow-2xl min-w-[200px]"
         style={{ backgroundColor: c.tooltipBg, borderColor: c.tooltipBorder }}>
      <p className="text-gray-400 text-xs mb-2 font-semibold uppercase tracking-wide" style={{ color: c.textSecondary }}>{d.dateLabel}</p>

      {/* Balance — full spend */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-400 text-xs" style={{ color: c.textSecondary }}>Balance (all expenses)</span>
        <span className="font-bold" style={{ color: c.blue }}>{formatCurrency(d.balance)}</span>
      </div>

      {/* Balance — essentials only */}
      {d.balanceEssentialOnly != null && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-400 text-xs" style={{ color: c.textSecondary }}>Balance (essentials only)</span>
          <span className="font-bold" style={{ color: c.purple }}>{formatCurrency(d.balanceEssentialOnly)}</span>
        </div>
      )}

      {/* Baseline comparison */}
      {hasBaseline && d.baseline != null && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs" style={{ color: c.textSecondary }}>Baseline</span>
          <span className="text-xs" style={{ color: c.textSecondary }}>{formatCurrency(d.baseline)}</span>
        </div>
      )}

      {/* Net burn / gain */}
      {d.month > 0 && (
        <>
          <div className="flex justify-between items-center mb-1 mt-1 pt-1 border-t border-gray-700">
            <span className="text-gray-400 text-xs" style={{ color: c.textSecondary }}>Burn (all)</span>
            <span className="text-xs font-semibold" style={{ color: burnColor }}>{burnLabel}</span>
          </div>
          {burnEssential != null && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-400 text-xs" style={{ color: c.textSecondary }}>Burn (essentials)</span>
              <span className="text-xs font-semibold" style={{ color: burnEssentialColor }}>{burnEssentialLabel}</span>
            </div>
          )}
        </>
      )}

      {/* Income */}
      {d.income > 0 && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-400 text-xs" style={{ color: c.textSecondary }}>Income</span>
          <span className="text-xs" style={{ color: c.emerald }}>{formatCurrency(d.income)}</span>
        </div>
      )}

      {/* One-time spike */}
      {d.oneTimeCost && (
        <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-700">
          <span className="text-xs" style={{ color: c.orange }}>One-time expense</span>
          <span className="text-xs font-bold" style={{ color: c.orange }}>−{formatCurrency(d.oneTimeCost)}</span>
        </div>
      )}

      {/* One-time income injection */}
      {d.oneTimeIncome && (
        <div className="flex justify-between items-center mt-1 pt-1 border-t border-gray-700">
          <span className="text-xs" style={{ color: c.emerald }}>One-time income</span>
          <span className="text-xs font-bold" style={{ color: c.emerald }}>+{formatCurrency(d.oneTimeIncome)}</span>
        </div>
      )}

      {/* Floor note */}
      {emergencyFloor > 0 && (
        <div className="text-xs mt-1 pt-1 border-t border-gray-700" style={{ color: c.amber }}>
          Floor: {formatCurrency(emergencyFloor)} protected
        </div>
      )}

      {/* Status badges */}
      <div className="flex gap-1 flex-wrap mt-2">
        {d.inBenefitWindow && (
          <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded">UI active</span>
        )}
        {d.jobActive && (
          <span className="text-xs bg-blue-900/50 text-blue-400 border border-blue-700/40 px-1.5 py-0.5 rounded">Employed</span>
        )}
        {d.oneTimeCost && (
          <span className="text-xs bg-orange-900/50 text-orange-400 border border-orange-700/40 px-1.5 py-0.5 rounded">Big expense</span>
        )}
        {d.oneTimeIncome && (
          <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded">Income boost</span>
        )}
      </div>
    </div>
  )
}

// ─── One-time event dots rendered via Area's dot prop ────────────────────────
function renderDot(props, c) {
  const { cx, cy, payload } = props
  if (!payload?.oneTimeCost && !payload?.oneTimeIncome) return null
  if (payload.oneTimeCost) {
    return (
      <g key={`dot-exp-${cx}-${cy}`}>
        <circle cx={cx} cy={cy} r={10} fill={c.orange} opacity={0.15} />
        <circle cx={cx} cy={cy} r={6} fill={c.orange} stroke="#7c2d12" strokeWidth={1.5} opacity={0.9} />
      </g>
    )
  }
  return (
    <g key={`dot-inc-${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={10} fill={c.emerald} opacity={0.15} />
      <circle cx={cx} cy={cy} r={6} fill={c.emerald} stroke="#14532d" strokeWidth={1.5} opacity={0.9} />
    </g>
  )
}

// ─── Main chart ───────────────────────────────────────────────────────────────
export default function BurndownChart({
  dataPoints,
  runoutDate,
  baseDataPoints,                          // optional: the no-what-if baseline or historical snapshot
  baselineLabel = 'No what-if baseline',   // label shown in callout / legend
  benefitStart,         // Date
  benefitEnd,           // Date
  emergencyFloor,       // number
  showEssentials = true,// whether to render the essentials-only line
  showBaseline   = true,// whether to render the baseline ghost line
}) {
  const c = useChartColors()
  const [zoom, setZoom] = useState('All')

  const zoomMonths = ZOOM_OPTIONS.find(z => z.label === zoom)?.months ?? Infinity

  // Merge baseline into primary data points, keyed by dateLabel ('MMM YYYY').
  // This handles both same-start baselines (what-if) and cross-timeline historical
  // snapshots that may start from a different calendar date.
  const mergedData = useMemo(() => {
    const baseMap = {}
    if (baseDataPoints) {
      for (const pt of baseDataPoints) baseMap[pt.dateLabel] = pt.balance
    }
    return dataPoints.map(pt => ({
      ...pt,
      baseline: baseMap[pt.dateLabel] ?? null,
    }))
  }, [dataPoints, baseDataPoints])

  // Apply zoom filter
  const chartData = useMemo(() => {
    const filtered = mergedData.filter(pt => pt.month <= zoomMonths)
    const MAX_POINTS = 72
    const step = Math.max(1, Math.ceil(filtered.length / MAX_POINTS))
    return filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1)
  }, [mergedData, zoomMonths])

  // One-time event counts (for legend/callouts)
  const oneTimeCount = chartData.filter(d => d.oneTimeCost).length
  const oneTimeIncomeCount = chartData.filter(d => d.oneTimeIncome).length

  const maxBalance = Math.max(...chartData.map(d => Math.max(d.balance, d.baseline ?? 0, d.balanceEssentialOnly ?? 0)), 1)

  const todayLabel = 'Feb 2026'

  // Benefit window labels (find matching dateLabels in chartData)
  const benefitStartLabel = benefitStart
    ? chartData.find(d => {
        const dt = new Date(d.date)
        const bs = new Date(benefitStart)
        return dt.getMonth() === bs.getMonth() && dt.getFullYear() === bs.getFullYear()
      })?.dateLabel
    : null

  const benefitEndLabel = benefitEnd
    ? chartData.find(d => {
        const dt = new Date(d.date)
        const be = new Date(benefitEnd)
        return dt.getMonth() === be.getMonth() && dt.getFullYear() === be.getFullYear()
      })?.dateLabel
    : null

  // Dynamic gradient stops: build colour stops based on balance thresholds
  // We compute where the 50% and 25% lines are as a fraction of maxBalance
  const pct50 = Math.max(0, Math.min(1, 1 - 0.5))   // 0.5 of max → 50% down
  const pct75 = Math.max(0, Math.min(1, 1 - 0.25))  // 0.75 down

  const hasBaseline = showBaseline && baseDataPoints && baseDataPoints.length > 0

  return (
    <div className="space-y-3">
      {/* ── Zoom controls + legend ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-blue-500" style={{ height: 2 }} />
            All expenses
          </span>
          {showEssentials && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4" style={{ height: 2, background: c.purple }} />
              Essentials only
            </span>
          )}
          {showBaseline && hasBaseline && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4" style={{ height: 2, background: `repeating-linear-gradient(90deg,${c.tick} 0,${c.tick} 4px,transparent 4px,transparent 8px)` }} />
              {baselineLabel}
            </span>
          )}
          {benefitStartLabel && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
              UI benefits
            </span>
          )}
          {oneTimeCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500" />
              One-time expense
            </span>
          )}
          {oneTimeIncomeCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
              One-time income
            </span>
          )}
          {emergencyFloor > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4" style={{ height: 2, background: `repeating-linear-gradient(90deg,${c.amber} 0,${c.amber} 3px,transparent 3px,transparent 6px)` }} />
              Floor ({formatCurrency(emergencyFloor)})
            </span>
          )}
        </div>

        {/* Zoom buttons */}
        <div className="flex gap-1">
          {ZOOM_OPTIONS.map(z => (
            <button
              key={z.label}
              onClick={() => setZoom(z.label)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                zoom === z.label
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="sensitive-chart" style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
            <defs>
              {/* Dynamic tri-colour gradient */}
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={c.emerald} stopOpacity={0.35} />
                <stop offset={`${pct50 * 100}%`} stopColor={c.amber} stopOpacity={0.25} />
                <stop offset={`${pct75 * 100}%`} stopColor={c.red} stopOpacity={0.20} />
                <stop offset="100%" stopColor={c.red} stopOpacity={0.03} />
              </linearGradient>

              {/* Subtle gradient for baseline ghost */}
              <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={c.tick} stopOpacity={0.12} />
                <stop offset="95%" stopColor={c.tick} stopOpacity={0.01} />
              </linearGradient>

              {/* Gradient for essentials-only line */}
              <linearGradient id="essentialGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={c.purple} stopOpacity={0.18} />
                <stop offset="95%" stopColor={c.purple} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />

            <XAxis
              dataKey="dateLabel"
              tick={{ fill: c.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
              tick={{ fill: c.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={45}
              domain={[0, maxBalance * 1.08]}
            />

            <Tooltip
              content={
                <CustomTooltip
                  emergencyFloor={emergencyFloor}
                  hasBaseline={hasBaseline}
                  c={c}
                />
              }
            />

            {/* ── UI benefit window shading ── */}
            {benefitStartLabel && benefitEndLabel && (
              <ReferenceArea
                x1={benefitStartLabel}
                x2={benefitEndLabel}
                fill={c.emerald}
                fillOpacity={0.06}
                stroke={c.emerald}
                strokeOpacity={0.2}
                strokeWidth={1}
              />
            )}

            {/* ── Emergency floor line ── */}
            {emergencyFloor > 0 && (
              <ReferenceLine
                y={emergencyFloor}
                stroke={c.amber}
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: `Floor ${formatCurrency(emergencyFloor)}`, fill: c.amber, fontSize: 10, position: 'insideTopRight', dy: -4 }}
              />
            )}

            {/* ── Zero line ── */}
            <ReferenceLine y={0} stroke={c.red} strokeDasharray="4 2" strokeWidth={1.5} />

            {/* ── Today marker ── */}
            <ReferenceLine
              x={todayLabel}
              stroke={c.amber}
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: 'Today', fill: c.amber, fontSize: 11, position: 'top' }}
            />

            {/* ── Baseline ghost area (rendered first / behind) ── */}
            {hasBaseline && (
              <Area
                type="monotone"
                dataKey="baseline"
                stroke={c.tooltipBorder}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                fill="url(#baselineGradient)"
                dot={false}
                activeDot={false}
                connectNulls
              />
            )}

            {/* ── Essentials-only balance area (rendered behind primary) ── */}
            {showEssentials && (
              <Area
                type="monotone"
                dataKey="balanceEssentialOnly"
                stroke={c.purple}
                strokeWidth={2}
                strokeDasharray="5 3"
                fill="url(#essentialGradient)"
                dot={false}
                activeDot={{ r: 4, fill: c.purple, stroke: '#4c1d95', strokeWidth: 2 }}
                connectNulls
              />
            )}

            {/* ── Primary balance area (all expenses) ── */}
            <Area
              type="monotone"
              dataKey="balance"
              stroke={c.blue}
              strokeWidth={2.5}
              fill="url(#balanceGradient)"
              dot={(props) => renderDot(props, c)}
              activeDot={{ r: 5, fill: c.blue, stroke: '#1e3a5f', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Below-chart contextual callouts ── */}
      <div className="flex flex-wrap gap-2 text-xs">
        {benefitStartLabel && (
          <span className="bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 px-2 py-1 rounded-md">
            UI benefits: {benefitStartLabel} → {benefitEndLabel || '—'}
          </span>
        )}
        {emergencyFloor > 0 && (
          <span className="bg-amber-950/40 border border-amber-800/30 text-amber-400 px-2 py-1 rounded-md">
            {formatCurrency(emergencyFloor)} floor protected
          </span>
        )}
        {showBaseline && hasBaseline && (
          <span className="bg-gray-800/60 border border-gray-700 text-gray-400 px-2 py-1 rounded-md">
            Dashed line = {baselineLabel}
          </span>
        )}
        {oneTimeCount > 0 && (
          <span className="bg-orange-950/40 border border-orange-800/30 text-orange-400 px-2 py-1 rounded-md">
            {oneTimeCount} one-time expense{oneTimeCount !== 1 ? 's' : ''} plotted
          </span>
        )}
        {oneTimeIncomeCount > 0 && (
          <span className="bg-emerald-950/40 border border-emerald-800/30 text-emerald-400 px-2 py-1 rounded-md">
            {oneTimeIncomeCount} one-time income injection{oneTimeIncomeCount !== 1 ? 's' : ''} plotted
          </span>
        )}
      </div>
    </div>
  )
}
