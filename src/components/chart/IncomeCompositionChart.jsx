import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '6M',  months: 6        },
  { label: '1Y',  months: 12       },
  { label: '2Y',  months: 24       },
  { label: 'All', months: Infinity },
]

function CustomTooltip({ active, payload, colors }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-sm shadow-2xl min-w-[190px]"
      style={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}` }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>{d.dateLabel}</p>
      <div className="space-y-1">
        {d.benefits > 0 && (
          <div className="flex justify-between gap-6">
            <span className="text-xs" style={{ color: colors.emerald }}>UI Benefits</span>
            <span className="text-xs font-semibold" style={{ color: colors.emerald }}>{formatCurrency(d.benefits)}</span>
          </div>
        )}
        {d.otherIncome > 0 && (
          <div className="flex justify-between gap-6">
            <span className="text-xs" style={{ color: colors.teal }}>Other Income</span>
            <span className="text-xs font-semibold" style={{ color: colors.teal }}>{formatCurrency(d.otherIncome)}</span>
          </div>
        )}
        <div
          className="flex justify-between gap-6 pt-1 mt-0.5"
          style={{ borderTop: `1px solid ${colors.tooltipBorder}` }}
        >
          <span className="text-xs" style={{ color: colors.textSecondary }}>Total Income</span>
          <span className="text-xs font-bold text-white">{formatCurrency(d.income)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-xs" style={{ color: colors.red }}>Total Outflow</span>
          <span className="text-xs font-bold" style={{ color: colors.red }}>{formatCurrency(d.outflow)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {d.inBenefitWindow && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#065f46', color: colors.emerald }}>UI active</span>
        )}
        {d.jobActive && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1e3a5f', color: colors.blue }}>Employed</span>
        )}
      </div>
    </div>
  )
}

export default function IncomeCompositionChart({ dataPoints, monthlyBenefits }) {
  const c = useChartColors()
  const [zoom, setZoom] = useState('2Y')
  const zoomMonths = ZOOM_OPTIONS.find(z => z.label === zoom)?.months ?? Infinity

  const chartData = useMemo(() => {
    const filtered = dataPoints.filter(pt => pt.month > 0 && pt.month <= zoomMonths)
    const MAX = 60
    const step = Math.max(1, Math.ceil(filtered.length / MAX))
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map(pt => {
        const benefits = pt.inBenefitWindow ? Math.round(monthlyBenefits) : 0
        const otherIncome = Math.max(0, pt.income - benefits)
        const outflow = Math.max(0, pt.income + pt.netBurn)
        return { ...pt, benefits, otherIncome, outflow }
      })
  }, [dataPoints, monthlyBenefits, zoomMonths])

  const maxVal = Math.max(...chartData.map(d => Math.max(d.income || 0, d.outflow || 0)), 1)
  const hasBenefits   = chartData.some(d => d.benefits > 0)
  const hasOtherIncome = chartData.some(d => d.otherIncome > 0)

  return (
    <div className="space-y-3">
      {/* Legend + zoom */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: c.tick }}>
          {hasBenefits && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-2.5 rounded-sm" style={{ background: c.withAlpha(c.emerald, '99') }} />
              UI Benefits
            </span>
          )}
          {hasOtherIncome && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-2.5 rounded-sm" style={{ background: c.withAlpha(c.teal, '99') }} />
              Other Income
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5" style={{ height: 2, background: c.orange }} />
            Outflow
          </span>
        </div>
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

      <div className="sensitive-chart" style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
            barCategoryGap="30%"
          >
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
              width={46}
              domain={[0, maxVal * 1.12]}
            />
            <Tooltip content={<CustomTooltip colors={c} />} />
            <ReferenceLine y={0} stroke={c.tooltipBorder} strokeWidth={1} />

            {/* Stacked bars: income breakdown */}
            <Bar dataKey="benefits"    stackId="inc" fill={c.withAlpha(c.emerald, '99')} maxBarSize={18} name="UI Benefits"   />
            <Bar dataKey="otherIncome" stackId="inc" fill={c.withAlpha(c.teal, '99')} maxBarSize={18} name="Other Income"  />

            {/* Outflow line overlay */}
            <Line
              type="monotone"
              dataKey="outflow"
              stroke={c.orange}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: c.orange, strokeWidth: 0 }}
              name="Outflow"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
