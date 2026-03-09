import { memo, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import { formatCurrency, formatAxisValue } from '../../utils/formatters'
import { getEffectivePayment } from '../../utils/ccPayment'
import { useChartColors } from '../../hooks/useChartColors'

function TopExpensesChart({ expenses = [], subscriptions = [], creditCards = [], investments = [] }) {
  const c = useChartColors()

  const TYPE_CONFIG = useMemo(() => ({
    essential:     { label: 'Essential',     color: c.blue },
    discretionary: { label: 'Discretionary', color: c.orange },
    subscription:  { label: 'Subscription',  color: c.purple },
    cc:            { label: 'CC Payment',    color: c.amber },
    investment:    { label: 'Investment',    color: c.teal },
  }), [c.blue, c.orange, c.purple, c.amber, c.teal])

  const chartData = useMemo(() => {
    const all = [
      ...expenses.map(e => ({
        label: e.category || 'Expense',
        amount: Number(e.monthlyAmount) || 0,
        type: e.essential ? 'essential' : 'discretionary',
      })),
      ...subscriptions
        .filter(s => s.active !== false)
        .map(s => ({
          label: s.name || 'Subscription',
          amount: Number(s.monthlyAmount) || 0,
          type: 'subscription',
        })),
      ...creditCards
        .filter(card => getEffectivePayment(card) > 0)
        .map(card => ({
          label: `${card.name || 'Card'} (pmt)`,
          amount: getEffectivePayment(card),
          type: 'cc',
        })),
      ...investments
        .filter(i => i.active !== false && (Number(i.monthlyAmount) || 0) > 0)
        .map(i => ({
          label: i.name || 'Investment',
          amount: Number(i.monthlyAmount) || 0,
          type: 'investment',
        })),
    ]
    return all
      .filter(x => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 14)
      .map(item => ({
        ...item,
        shortLabel: item.label.length > 20 ? item.label.slice(0, 18) + '…' : item.label,
      }))
  }, [expenses, subscriptions, creditCards, investments])

  const presentTypes = Object.keys(TYPE_CONFIG).filter(t => chartData.some(d => d.type === t))

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: 260, color: c.tick }}
      >
        No expense data to display yet.
      </div>
    )
  }

  const chartHeight = Math.max(260, chartData.length * 34 + 40)

  function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    const cfg = TYPE_CONFIG[d.type]
    return (
      <div
        className="rounded-xl px-3 py-2.5 shadow-2xl"
        style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}` }}
      >
        <p className="text-sm font-semibold text-white mb-0.5">{d.label}</p>
        <p className="text-sm font-bold" style={{ color: cfg?.color ?? '#fff' }}>
          {formatCurrency(d.amount)}<span className="text-xs font-normal opacity-60">/mo</span>
        </p>
        <p className="text-xs mt-0.5" style={{ color: c.tick }}>
          {cfg?.label ?? d.type}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: c.tick }}>
        {presentTypes.map(t => {
          const cfg = TYPE_CONFIG[t]
          return (
            <span key={t} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-sm"
                style={{ width: 10, height: 10, background: cfg.color }}
              />
              {cfg.label}
            </span>
          )
        })}
      </div>

      <div className="sensitive-chart" style={{ width: '100%', height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 72, left: 4, bottom: 4 }}
            barSize={18}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={c.grid} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={formatAxisValue}
              tick={{ fill: c.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              tick={{ fill: c.textSecondary, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={128}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="amount" radius={[0, 3, 3, 0]}>
              {chartData.map((entry, i) => {
                const cfg = TYPE_CONFIG[entry.type]
                return <Cell key={i} fill={c.withAlpha(cfg?.color ?? c.tick, 'cc')} />
              })}
              <LabelList
                dataKey="amount"
                position="right"
                formatter={v => formatCurrency(v)}
                style={{ fill: c.textSecondary, fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default memo(TopExpensesChart)
