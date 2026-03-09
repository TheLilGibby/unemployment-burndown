import { thinChartData } from '../../utils/thinChartData'
import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatAxisValue } from '../../utils/formatters'
import { useChartColors } from '../../hooks/useChartColors'

const ZOOM_OPTIONS = [
  { label: '6M',  months: 6        },
  { label: '1Y',  months: 12       },
  { label: '2Y',  months: 24       },
  { label: 'All', months: Infinity },
]

function CustomTooltip({ active, payload, c }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const net = d.outflow - d.income
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-sm shadow-2xl min-w-[190px]"
      style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}` }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: c.textSecondary }}>{d.dateLabel}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-xs" style={{ color: c.emerald }}>Income</span>
          <span className="font-semibold text-xs" style={{ color: c.emerald }}>{formatCurrency(d.income)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-xs" style={{ color: c.red }}>Outflow</span>
          <span className="font-semibold text-xs" style={{ color: c.red }}>{formatCurrency(d.outflow)}</span>
        </div>
        <div
          className="flex justify-between gap-6 pt-1 mt-1"
          style={{ borderTop: `1px solid ${c.tooltipBorder}` }}
        >
          <span className="text-xs" style={{ color: c.textSecondary }}>Net</span>
          <span
            className="font-bold text-xs"
            style={{ color: net > 0 ? c.red : c.emerald }}
          >
            {net > 0 ? '−' : '+'}{formatCurrency(Math.abs(net))}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {d.inBenefitWindow && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#065f46', color: c.emerald }}>UI active</span>
        )}
        {d.jobActive && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1e3a5f', color: c.blue }}>Employed</span>
        )}
      </div>
    </div>
  )
}

export default function IncomeVsExpensesChart({ dataPoints }) {
  const c = useChartColors()
  const [zoom, setZoom] = useState('1Y')
  const zoomMonths = ZOOM_OPTIONS.find(z => z.label === zoom)?.months ?? Infinity

  const chartData = useMemo(() => {
    const filtered = dataPoints.filter(pt => pt.month > 0 && pt.month <= zoomMonths)


    return thinChartData(filtered, 36)

      .map(pt => ({
        ...pt,
        // outflow = expenses + investments (netBurn = outflow − income)
        outflow: Math.max(0, pt.income + pt.netBurn),
      }))
  }, [dataPoints, zoomMonths])

  const maxVal = Math.max(...chartData.map(d => Math.max(d.income || 0, d.outflow || 0)), 1)

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 260, color: c.tick }}
      >
        No income or expense data to display yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Legend + zoom */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs" style={{ color: c.tick }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2.5 rounded-sm" style={{ background: c.withAlpha(c.emerald, '99') }} />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2.5 rounded-sm" style={{ background: c.withAlpha(c.orange, '99') }} />
            Outflow
          </span>
          <span className="text-xs" style={{ color: c.tooltipBorder }}>
            Gap = net burn each month
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
            barGap={2}
            barCategoryGap="25%"
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
              tickFormatter={formatAxisValue}
              tick={{ fill: c.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={46}
              domain={[0, maxVal * 1.12]}
            />
            <Tooltip content={<CustomTooltip c={c} />} />
            <ReferenceLine y={0} stroke={c.tooltipBorder} strokeWidth={1} />
            <Bar dataKey="income"  fill={c.withAlpha(c.emerald, '99')} radius={[2, 2, 0, 0]} maxBarSize={14} name="Income"  />
            <Bar dataKey="outflow" fill={c.withAlpha(c.orange, '99')} radius={[2, 2, 0, 0]} maxBarSize={14} name="Outflow" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
