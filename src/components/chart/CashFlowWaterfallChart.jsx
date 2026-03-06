import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { formatCurrency } from '../../utils/formatters'
import { getEffectivePayment } from '../../utils/ccPayment'

/**
 * Build waterfall data showing the flow from income through expenses and CC payments
 * down to the net remaining amount.
 *
 * @param {object} params
 * @param {Array} params.expenses - Regular expense items
 * @param {Array} params.subscriptions - Active subscriptions
 * @param {Array} params.creditCards - Credit cards with payment info
 * @param {number} params.monthlyIncome - Total monthly income
 * @param {number} params.monthlyBenefits - UI benefits per month
 * @param {Array} params.ccTransactionsByCard - Map of cardId -> categorized transactions
 */
function buildWaterfallData({ expenses, subscriptions, creditCards, monthlyIncome, monthlyBenefits, ccTransactionsByCard }) {
  const bars = []
  const totalIncome = monthlyIncome + monthlyBenefits

  // Start with income
  let running = totalIncome
  if (totalIncome > 0) {
    bars.push({ label: 'Income', value: totalIncome, base: 0, fill: '#22c55e', isIncome: true })
  }

  // Direct expenses (essential)
  const essentialExpenses = expenses.filter(e => e.essential)
  const essentialTotal = essentialExpenses.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)
  if (essentialTotal > 0) {
    running -= essentialTotal
    bars.push({ label: 'Essential', value: essentialTotal, base: Math.max(0, running), fill: '#ef4444', isExpense: true,
      detail: essentialExpenses.slice(0, 3).map(e => `${e.category}: ${formatCurrency(e.monthlyAmount)}`).join(', ') })
  }

  // Direct expenses (discretionary)
  const discretionary = expenses.filter(e => !e.essential)
  const discTotal = discretionary.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)
  if (discTotal > 0) {
    running -= discTotal
    bars.push({ label: 'Discretionary', value: discTotal, base: Math.max(0, running), fill: '#f97316', isExpense: true,
      detail: discretionary.slice(0, 3).map(e => `${e.category}: ${formatCurrency(e.monthlyAmount)}`).join(', ') })
  }

  // Subscriptions
  const activeSubs = (subscriptions || []).filter(s => s.active !== false)
  const subsTotal = activeSubs.reduce((s, x) => s + (Number(x.monthlyAmount) || 0), 0)
  if (subsTotal > 0) {
    running -= subsTotal
    bars.push({ label: 'Subscriptions', value: subsTotal, base: Math.max(0, running), fill: '#a78bfa', isExpense: true,
      detail: activeSubs.slice(0, 3).map(s => `${s.name}: ${formatCurrency(s.monthlyAmount)}`).join(', ') })
  }

  // Credit card payments with optional category breakdown
  const activeCards = (creditCards || []).filter(c => getEffectivePayment(c) > 0)
  for (const card of activeCards) {
    const pmt = getEffectivePayment(card)
    running -= pmt

    // Build detail from transaction categories if available
    const txns = ccTransactionsByCard?.[card.id] || []
    let detail = ''
    if (txns.length > 0) {
      // Group by category
      const byCat = {}
      for (const t of txns) {
        const cat = t.category || 'Other'
        byCat[cat] = (byCat[cat] || 0) + Math.abs(t.amount || 0)
      }
      const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1])
      detail = sorted.slice(0, 4).map(([cat, amt]) => `${cat}: ${formatCurrency(amt)}`).join(', ')
    }

    bars.push({
      label: card.name || 'CC',
      value: pmt,
      base: Math.max(0, running),
      fill: '#f59e0b',
      isCC: true,
      detail,
      subItems: txns.length > 0 ? getCategoryBreakdown(txns) : null,
    })
  }

  // Net remaining
  bars.push({
    label: 'Net',
    value: Math.abs(running),
    base: running >= 0 ? 0 : 0,
    fill: running >= 0 ? '#10b981' : '#ef4444',
    isNet: true,
  })

  return bars
}

function getCategoryBreakdown(txns) {
  const byCat = {}
  for (const t of txns) {
    const cat = t.category || 'Other'
    byCat[cat] = (byCat[cat] || 0) + Math.abs(t.amount || 0)
  }
  return Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, amount]) => ({ category, amount }))
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null

  return (
    <div className="rounded-xl px-3 py-2.5 text-sm shadow-2xl" style={{ background: '#111827', border: '1px solid #374151' }}>
      <p className="font-semibold text-xs text-white mb-1">{d.label}</p>
      <p className="font-bold" style={{ color: d.fill }}>
        {d.isIncome ? '+' : d.isNet && d.base === 0 ? '' : '−'}{formatCurrency(d.value)}/mo
      </p>
      {d.detail && (
        <p className="text-xs mt-1 max-w-[220px]" style={{ color: '#9ca3af' }}>{d.detail}</p>
      )}
      {d.subItems && (
        <div className="mt-1.5 pt-1.5 space-y-0.5" style={{ borderTop: '1px solid #374151' }}>
          {d.subItems.map((item, i) => (
            <div key={i} className="flex justify-between gap-3 text-xs" style={{ color: '#9ca3af' }}>
              <span className="truncate max-w-[120px]">{item.category}</span>
              <span>{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CashFlowWaterfallChart({
  expenses,
  subscriptions,
  creditCards,
  monthlyIncome = 0,
  monthlyBenefits = 0,
  ccTransactionsByCard = {},
}) {
  const data = useMemo(() =>
    buildWaterfallData({ expenses, subscriptions, creditCards, monthlyIncome, monthlyBenefits, ccTransactionsByCard }),
    [expenses, subscriptions, creditCards, monthlyIncome, monthlyBenefits, ccTransactionsByCard]
  )

  if (data.length <= 1) {
    return (
      <div className="flex items-center justify-center text-sm" style={{ height: 260, color: '#6b7280' }}>
        Add expenses and credit cards to see the cash flow breakdown.
      </div>
    )
  }

  return (
    <div className="sensitive-chart" style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={data.length > 8 ? -30 : 0}
            textAnchor={data.length > 8 ? 'end' : 'middle'}
            height={data.length > 8 ? 50 : 30}
          />
          <YAxis
            tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <ReferenceLine y={0} stroke="#374151" />

          {/* Invisible base bar for waterfall effect */}
          <Bar dataKey="base" stackId="stack" fill="transparent" isAnimationActive={false} />
          {/* Visible value bar */}
          <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} opacity={entry.isCC ? 0.9 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
