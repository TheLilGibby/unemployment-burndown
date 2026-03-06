import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'

const ZOOM_OPTIONS = [
  { label: '6M',  months: 6        },
  { label: '1Y',  months: 12       },
  { label: '2Y',  months: 24       },
  { label: 'All', months: Infinity },
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const net = d.outflow - d.income
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-sm shadow-2xl min-w-[190px]"
      style={{ background: '#111827', border: '1px solid #374151' }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: '#9ca3af' }}>{d.dateLabel}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-xs" style={{ color: '#6ee7b7' }}>Income</span>
          <span className="font-semibold text-xs" style={{ color: '#34d399' }}>{formatCurrency(d.income)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-xs" style={{ color: '#fca5a5' }}>Outflow</span>
          <span className="font-semibold text-xs" style={{ color: '#f87171' }}>{formatCurrency(d.outflow)}</span>
        </div>
        <div
          className="flex justify-between gap-6 pt-1 mt-1"
          style={{ borderTop: '1px solid #374151' }}
        >
          <span className="text-xs" style={{ color: '#9ca3af' }}>Net</span>
          <span
            className="font-bold text-xs"
            style={{ color: net > 0 ? '#f87171' : '#34d399' }}
          >
            {net > 0 ? '−' : '+'}{formatCurrency(Math.abs(net))}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {d.inBenefitWindow && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#065f46', color: '#6ee7b7' }}>UI active</span>
        )}
        {d.jobActive && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#93c5fd' }}>Employed</span>
        )}
      </div>
    </div>
  )
}

export default function IncomeVsExpensesChart({ dataPoints }) {
  const [zoom, setZoom] = useState('1Y')
  const zoomMonths = ZOOM_OPTIONS.find(z => z.label === zoom)?.months ?? Infinity

  const chartData = useMemo(() => {
    const filtered = dataPoints.filter(pt => pt.month > 0 && pt.month <= zoomMonths)
    const MAX = 36
    const step = Math.max(1, Math.ceil(filtered.length / MAX))
    return filtered
      .filter((_, i) => i % step === 0 || i === filtered.length - 1)
      .map(pt => ({
        ...pt,
        // outflow = expenses + investments (netBurn = outflow − income)
        outflow: Math.max(0, pt.income + pt.netBurn),
      }))
  }, [dataPoints, zoomMonths])

  const maxVal = Math.max(...chartData.map(d => Math.max(d.income || 0, d.outflow || 0)), 1)

  return (
    <div className="space-y-3">
      {/* Legend + zoom */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs" style={{ color: '#6b7280' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2.5 rounded-sm" style={{ background: '#22c55e99' }} />
            Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2.5 rounded-sm" style={{ background: '#f9731699' }} />
            Outflow
          </span>
          <span className="text-xs" style={{ color: '#4b5563' }}>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={46}
              domain={[0, maxVal * 1.12]}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
            <Bar dataKey="income"  fill="#22c55e99" radius={[2, 2, 0, 0]} maxBarSize={14} name="Income"  />
            <Bar dataKey="outflow" fill="#f9731699" radius={[2, 2, 0, 0]} maxBarSize={14} name="Outflow" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
