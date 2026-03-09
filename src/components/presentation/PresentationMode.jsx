import { useState, useEffect, useCallback } from 'react'
import BurndownChart from '../chart/BurndownChart'
import { formatCurrency, formatDate, formatMonths } from '../../utils/formatters'

// ─── Slide registry ──────────────────────────────────────────────────────────
const SLIDES = [
  { id: 'cover',     title: 'Runway Summary'     },
  { id: 'chart',     title: 'Balance Over Time'  },
  { id: 'cashflow',  title: 'Monthly Cash Flow'  },
  { id: 'expenses',  title: 'Expense Breakdown'  },
  { id: 'scenarios', title: 'What-If Scenarios'  },
  { id: 'actions',   title: 'Key Dates & Assets' },
]

// ─── Shared slide frame ───────────────────────────────────────────────────────
// All slides share this outer frame: header strip + content area
function SlideFrame({ slideNum, total, title, accent = '#3b82f6', children }) {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Slide header bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-10 py-4 border-b border-white/[0.07]"
        style={{ background: 'rgba(15,23,42,0.8)' }}
      >
        <div className="flex items-center gap-3">
          {/* Accent pip */}
          <span className="inline-block w-1 h-5 rounded-full" style={{ background: accent }} />
          <span className="text-sm font-semibold tracking-wide text-white/90">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/30 font-mono select-none">{slideNum} / {total}</span>
          <span className="text-xs text-white/20 select-none font-light">Financial Runway Planner</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 px-10 py-8 overflow-hidden">
        {children}
      </div>

      {/* Bottom accent rule */}
      <div className="flex-shrink-0 h-px" style={{ background: `linear-gradient(90deg, ${accent}40, transparent)` }} />
    </div>
  )
}

// ─── Stat box ─────────────────────────────────────────────────────────────────
function StatBox({ label, value, sub, color = 'text-white', size = 'xl', border = 'border-white/10' }) {
  const sizeClass = size === '2xl' ? 'text-2xl' : size === 'lg' ? 'text-lg' : 'text-xl'
  return (
    <div className={`bg-white/[0.04] border ${border} rounded-xl p-4 flex flex-col gap-1`}>
      <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">{label}</p>
      <p className={`${sizeClass} font-bold leading-tight ${color}`}>{value}</p>
      {sub && <p className="text-xs text-white/30">{sub}</p>}
    </div>
  )
}

// ─── Slide 1: Cover ───────────────────────────────────────────────────────────
function SlideCover({ current, base, totalSavings, hasWhatIf }) {
  const months = current.totalRunwayMonths

  let accentColor, statusText, statusBg
  if (months === null || months > 6) {
    accentColor = '#10b981'; statusText = months === null ? 'Fully Covered' : 'On Track'; statusBg = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
  } else if (months > 3) {
    accentColor = '#f59e0b'; statusText = 'Caution'; statusBg = 'bg-amber-500/10 border-amber-500/20 text-amber-400'
  } else {
    accentColor = '#ef4444'; statusText = 'Critical'; statusBg = 'bg-red-500/10 border-red-500/20 text-red-400'
  }

  const baselineDelta = hasWhatIf && base.totalRunwayMonths != null && current.totalRunwayMonths != null
    ? current.totalRunwayMonths - base.totalRunwayMonths : null

  return (
    <div className="h-full flex flex-col justify-center gap-7">
      {/* Hero number */}
      <div className="text-center">
        <span className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full border mb-5 ${statusBg}`}>
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
          {statusText}
        </span>

        {months === null ? (
          <p className="text-8xl font-black text-white leading-none mb-3">10+ Yrs</p>
        ) : (
          <p className="text-8xl font-black text-white leading-none mb-3" style={{ color: accentColor }}>
            {formatDate(current.runoutDate)}
          </p>
        )}
        <p className="text-xl text-white/50">
          {months === null ? 'No runout within 10-year projection' : `${formatMonths(months)} of financial runway remaining`}
        </p>
      </div>

      {/* Four key metrics */}
      <div className="grid grid-cols-4 gap-4">
        <StatBox
          label="Current Balance"
          value={formatCurrency(totalSavings)}
          color="text-white"
          size="xl"
        />
        <StatBox
          label="Net Burn / Mo"
          value={`${current.currentNetBurn > 0 ? '−' : '+'}${formatCurrency(Math.abs(current.currentNetBurn))}`}
          color={current.currentNetBurn > 0 ? 'text-red-400' : 'text-emerald-400'}
          size="xl"
        />
        <StatBox
          label="Monthly Expenses"
          value={formatCurrency(current.effectiveExpenses)}
          color="text-orange-300"
          size="xl"
        />
        <StatBox
          label="UI Benefits / Mo"
          value={formatCurrency(current.monthlyBenefits)}
          color="text-emerald-400"
          size="xl"
        />
      </div>

      {/* What-if delta banner */}
      {baselineDelta !== null && (
        <div className={`rounded-xl border px-5 py-3 text-sm text-center ${
          baselineDelta > 0
            ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-300'
            : 'bg-red-500/8 border-red-500/20 text-red-300'
        }`}>
          {baselineDelta > 0
            ? <>Your what-if scenarios extend runway by <strong>{formatMonths(baselineDelta)}</strong> compared to the no-adjustment baseline.</>
            : <>Your what-if changes shorten runway by <strong>{formatMonths(Math.abs(baselineDelta))}</strong> vs. baseline.</>
          }
        </div>
      )}
    </div>
  )
}

// ─── Slide 2: Chart ───────────────────────────────────────────────────────────
function SlideChart({ current, base, hasWhatIf }) {
  return (
    <div className="h-full flex flex-col gap-5">
      {/* Summary strip above chart */}
      <div className="flex items-center gap-6 flex-shrink-0">
        <div>
          <p className="text-xs text-white/30 uppercase tracking-widest mb-0.5">Projected Runout</p>
          <p className="text-lg font-bold text-white">
            {current.runoutDate ? formatDate(current.runoutDate) : 'None in 10-yr window'}
          </p>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div>
          <p className="text-xs text-white/30 uppercase tracking-widest mb-0.5">Runway</p>
          <p className="text-lg font-bold text-emerald-400">
            {current.totalRunwayMonths != null ? formatMonths(current.totalRunwayMonths) : '10+ Years'}
          </p>
        </div>
        {hasWhatIf && (
          <>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-0.5">Baseline</p>
              <p className="text-lg font-bold text-white/50">
                {base.totalRunwayMonths != null ? formatMonths(base.totalRunwayMonths) : '10+ Years'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <BurndownChart
          dataPoints={current.dataPoints}
          runoutDate={current.runoutDate}
          baseDataPoints={hasWhatIf ? base.dataPoints : null}
          benefitStart={current.benefitStart}
          benefitEnd={current.benefitEnd}
          emergencyFloor={current.emergencyFloor}
        />
      </div>
    </div>
  )
}

// ─── Slide 3: Monthly Cash Flow ───────────────────────────────────────────────
function SlideCashFlow({ current, unemployment, whatIf }) {
  const income = current.monthlyBenefits
  const totalExpenses = current.effectiveExpenses
  const investments = current.monthlyInvestments
  const sideIncome = Number(whatIf.sideIncomeMonthly) || 0
  const jobSalary  = (Number(whatIf.jobOfferSalary) || 0) && whatIf.jobOfferStartDate
    ? Number(whatIf.jobOfferSalary) : 0

  const totalIn  = income + sideIncome + jobSalary
  const totalOut = totalExpenses + investments
  const net      = totalOut - totalIn  // positive = burning

  const rows = [
    { label: 'UI Benefits',    value: income,         color: '#10b981', type: 'in'  },
    { label: 'Side Income',    value: sideIncome,     color: '#14b8a6', type: 'in'  },
    { label: 'Job Offer',      value: jobSalary,      color: '#60a5fa', type: 'in'  },
    { label: 'Living Expenses',value: totalExpenses,  color: '#f97316', type: 'out' },
    { label: 'Investments',    value: investments,    color: '#a78bfa', type: 'out' },
  ].filter(r => r.value > 0)

  const maxVal = Math.max(totalIn, totalOut, 1)

  const benefitEndDate = current.benefitEnd
    ? new Date(current.benefitEnd).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—'

  return (
    <div className="h-full flex flex-col gap-6 justify-center">
      {/* Net burn hero */}
      <div className="flex items-center gap-8">
        <div className="flex-1 text-center bg-white/[0.04] border border-white/10 rounded-2xl py-7">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Net Monthly Burn</p>
          <p className={`text-6xl font-black ${net > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {net > 0 ? '−' : '+'}{formatCurrency(Math.abs(net))}
          </p>
          <p className="text-sm text-white/30 mt-2">
            {net > 0 ? 'drawing down savings each month' : 'net positive — savings growing'}
          </p>
        </div>

        {/* In vs Out summary */}
        <div className="w-52 space-y-4 flex-shrink-0">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-xs text-emerald-400/70 uppercase tracking-widest mb-1">Total In</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalIn)}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-400/70 uppercase tracking-widest mb-1">Total Out</p>
            <p className="text-2xl font-bold text-red-400">{formatCurrency(totalOut)}</p>
          </div>
        </div>
      </div>

      {/* Horizontal bar breakdown */}
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-36 text-right text-xs text-white/50 flex-shrink-0">{r.label}</div>
            <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center justify-end pr-2"
                style={{ width: `${(r.value / maxVal) * 100}%`, background: r.color + '99' }}
              >
                <span className="text-xs font-semibold text-white">{formatCurrency(r.value)}</span>
              </div>
            </div>
            <div className="w-4 flex-shrink-0">
              <span className={`text-xs font-bold ${r.type === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                {r.type === 'in' ? '↑' : '↓'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Benefits window note */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl px-5 py-2.5 text-xs text-white/40 text-center">
        UI benefits active through <span className="text-white/70 font-medium">{benefitEndDate}</span>
        &nbsp;·&nbsp; {formatCurrency(current.monthlyBenefits)}/mo · {unemployment.durationWeeks} weeks coverage
      </div>
    </div>
  )
}

// ─── Slide 4: Expense Breakdown ───────────────────────────────────────────────
function SlideExpenses({ expenses, subscriptions, investments, whatIf }) {
  const reductionPct = Number(whatIf.expenseReductionPct) || 0

  const essentialItems      = expenses.filter(e => e.essential)
  const discretionaryItems  = expenses.filter(e => !e.essential)
  const activeSubs          = subscriptions.filter(s => s.active !== false)
  const activeInvest        = investments.filter(i => i.active)

  const essentialTotal = essentialItems.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)
  const discTotal      = discretionaryItems.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)
  const subsTotal      = activeSubs.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)
  const investTotal    = activeInvest.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)

  const discAfterCut  = discTotal * (1 - reductionPct / 100)
  const subsAfterCut  = subsTotal * (1 - reductionPct / 100)
  const grandTotal    = essentialTotal + discAfterCut + subsAfterCut + investTotal

  const categories = [
    { label: 'Essential',     value: essentialTotal, color: '#3b82f6', items: essentialItems },
    { label: 'Discretionary', value: discAfterCut,   color: '#f97316', items: discretionaryItems },
    { label: 'Subscriptions', value: subsAfterCut,   color: '#a78bfa', items: activeSubs.map(s => ({ category: s.name, monthlyAmount: s.monthlyAmount })) },
    { label: 'Investments',   value: investTotal,    color: '#14b8a6', items: activeInvest.map(i => ({ category: i.name, monthlyAmount: i.monthlyAmount })) },
  ].filter(c => c.value > 0)

  return (
    <div className="h-full flex flex-col gap-6 justify-center">
      {/* Header row */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Total Monthly Outgoing</p>
          <p className="text-5xl font-black text-white">{formatCurrency(grandTotal)}</p>
        </div>
        {reductionPct > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-3 text-center">
            <p className="text-xs text-blue-400/70 uppercase tracking-widest">What-If Cut</p>
            <p className="text-3xl font-black text-blue-400">{reductionPct}%</p>
            <p className="text-xs text-white/30">on non-essential</p>
          </div>
        )}
      </div>

      {/* Stacked bar */}
      <div className="h-5 rounded-full overflow-hidden flex">
        {categories.map(c => (
          <div
            key={c.label}
            style={{ width: `${(c.value / Math.max(grandTotal, 1)) * 100}%`, background: c.color + 'cc' }}
            title={`${c.label}: ${formatCurrency(c.value)}`}
          />
        ))}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-4 gap-4">
        {categories.map(c => (
          <div key={c.label} className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-xs text-white/50 uppercase tracking-wide font-semibold">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-white mb-3">{formatCurrency(c.value)}</p>
            <p className="text-xs text-white/20 mb-2">
              {Math.round((c.value / Math.max(grandTotal, 1)) * 100)}% of total
            </p>
            <div className="space-y-1 border-t border-white/5 pt-2">
              {c.items.slice(0, 4).map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-white/30 truncate mr-1">{item.category || item.name}</span>
                  <span className="text-white/50 flex-shrink-0">{formatCurrency(item.monthlyAmount)}</span>
                </div>
              ))}
              {c.items.length > 4 && (
                <p className="text-xs text-white/20">+{c.items.length - 4} more</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Slide 5: Scenarios ───────────────────────────────────────────────────────
function SlideScenarios({ whatIf, current, base, assetProceeds }) {
  const baseMonths    = base.totalRunwayMonths
  const currentMonths = current.totalRunwayMonths
  const delta         = baseMonths != null && currentMonths != null ? currentMonths - baseMonths : null

  const activeScenarios = [
    whatIf.expenseReductionPct > 0 && {
      icon: '✂️', label: 'Expense Cuts',
      desc: `${whatIf.expenseReductionPct}% off non-essential spending`,
      value: formatCurrency((Number(whatIf.expenseReductionPct) / 100) * base.effectiveExpenses) + '/mo saved',
      color: '#60a5fa',
    },
    whatIf.sideIncomeMonthly > 0 && {
      icon: '💰', label: 'Side Income',
      desc: 'Part-time / freelance earnings',
      value: `+${formatCurrency(whatIf.sideIncomeMonthly)}/mo`,
      color: '#10b981',
    },
    assetProceeds > 0 && {
      icon: '🏷️', label: 'Asset Sales',
      desc: 'One-time cash injection',
      value: `+${formatCurrency(assetProceeds)}`,
      color: '#a78bfa',
    },
    (Number(whatIf.emergencyFloor) || 0) > 0 && {
      icon: '🛡️', label: 'Cash Floor',
      desc: 'Protected reserve',
      value: formatCurrency(whatIf.emergencyFloor),
      color: '#f59e0b',
    },
    (Number(whatIf.benefitDelayWeeks) || 0) > 0 && {
      icon: '⚠️', label: 'Benefit Delay',
      desc: `${whatIf.benefitDelayWeeks} week processing delay`,
      value: `${whatIf.benefitDelayWeeks} wks`,
      color: '#f87171',
    },
    (Number(whatIf.jobOfferSalary) || 0) > 0 && whatIf.jobOfferStartDate && {
      icon: '💼', label: 'Job Offer',
      desc: `Starting ${new Date(whatIf.jobOfferStartDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
      value: `+${formatCurrency(whatIf.jobOfferSalary)}/mo`,
      color: '#34d399',
    },
    (whatIf.freelanceRamp || []).some(t => t.monthlyAmount > 0) && {
      icon: '📈', label: 'Freelance Ramp',
      desc: `${(whatIf.freelanceRamp || []).filter(t => t.monthlyAmount > 0).length} income tiers`,
      value: `up to +${formatCurrency(Math.max(...(whatIf.freelanceRamp || []).map(t => Number(t.monthlyAmount) || 0)))}/mo`,
      color: '#2dd4bf',
    },
  ].filter(Boolean)

  return (
    <div className="h-full flex flex-col gap-6 justify-center">
      {/* Before / After / Delta row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 text-center">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Baseline Runway</p>
          <p className="text-3xl font-bold text-white/60">
            {baseMonths != null ? formatMonths(baseMonths) : '10+ yrs'}
          </p>
          <p className="text-xs text-white/20 mt-1">no adjustments</p>
        </div>

        <div className={`rounded-xl p-5 text-center border ${
          delta == null ? 'bg-white/[0.04] border-white/10'
          : delta >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Scenario Impact</p>
          {delta != null ? (
            <p className={`text-4xl font-black ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {delta >= 0 ? '+' : '−'}{formatMonths(Math.abs(delta))}
            </p>
          ) : (
            <p className="text-2xl text-white/30">—</p>
          )}
          <p className="text-xs text-white/20 mt-1">vs. baseline</p>
        </div>

        <div className={`rounded-xl p-5 text-center border ${
          delta != null && delta >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <p className="text-xs text-white/30 uppercase tracking-widest mb-2">With Scenarios</p>
          <p className={`text-3xl font-bold ${delta != null && delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {currentMonths != null ? formatMonths(currentMonths) : '10+ yrs'}
          </p>
          <p className="text-xs text-white/20 mt-1">all adjustments applied</p>
        </div>
      </div>

      {/* Active scenario cards */}
      {activeScenarios.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {activeScenarios.map((s, i) => (
            <div
              key={i}
              className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ borderLeftColor: s.color + '80', borderLeftWidth: 3 }}
            >
              <span className="text-lg leading-none mt-0.5">{s.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/80 mb-0.5">{s.label}</p>
                <p className="text-xs text-white/35 mb-1 leading-snug">{s.desc}</p>
                <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-white/20 text-sm">
          No what-if scenarios are currently active. Enable them in the What-If panel.
        </div>
      )}
    </div>
  )
}

// ─── Slide 6: Key Dates & Assets ─────────────────────────────────────────────
function SlideActions({ oneTimeExpenses, assets, current, unemployment, whatIf }) {
  const today = new Date()

  const upcomingExpenses = (oneTimeExpenses || [])
    .filter(e => e.date && e.amount && new Date(e.date) > today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)

  const keyDates = [
    { label: 'Benefits Start',  date: current.benefitStart,              color: '#10b981', icon: '📥' },
    { label: 'Benefits End',    date: current.benefitEnd,                color: '#f97316', icon: '📭' },
    whatIf.jobOfferStartDate && { label: 'Job Starts',    date: new Date(whatIf.jobOfferStartDate), color: '#60a5fa', icon: '💼' },
    whatIf.freezeDate        && { label: 'Expense Freeze',date: new Date(whatIf.freezeDate),        color: '#a78bfa', icon: '🧊' },
    { label: 'Runway End',      date: current.runoutDate,                color: '#ef4444', icon: '🏁' },
  ].filter(Boolean).filter(d => d.date).sort((a, b) => new Date(a.date) - new Date(b.date))

  const sellableAssets = assets.filter(a => a.includedInWhatIf)
  const assetTotal = sellableAssets.reduce((s, a) => s + (Number(a.estimatedValue) || 0), 0)

  return (
    <div className="h-full grid grid-cols-3 gap-6">
      {/* Key dates */}
      <div className="flex flex-col gap-3">
        <p className="text-xs text-white/30 uppercase tracking-widest font-semibold">Key Dates</p>
        <div className="space-y-2">
          {keyDates.map((d, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5">
              <span className="text-base">{d.icon}</span>
              <div className="min-w-0">
                <p className="text-xs text-white/30">{d.label}</p>
                <p className="text-sm font-semibold" style={{ color: d.color }}>
                  {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
          {keyDates.length === 0 && <p className="text-xs text-white/20">No key dates set.</p>}
        </div>
      </div>

      {/* Upcoming expenses */}
      <div className="flex flex-col gap-3">
        <p className="text-xs text-white/30 uppercase tracking-widest font-semibold">
          Upcoming Expenses {upcomingExpenses.length > 0 && `(${upcomingExpenses.length})`}
        </p>
        <div className="space-y-2">
          {upcomingExpenses.length === 0 && <p className="text-xs text-white/20">No scheduled one-time expenses.</p>}
          {upcomingExpenses.map((e, i) => (
            <div key={i} className="flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5">
              <div className="min-w-0 mr-2">
                <p className="text-sm text-white font-medium truncate">{e.description || 'Expense'}</p>
                <p className="text-xs text-white/30">
                  {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className="text-orange-400 text-sm font-bold flex-shrink-0">−{formatCurrency(e.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assets */}
      <div className="flex flex-col gap-3">
        <p className="text-xs text-white/30 uppercase tracking-widest font-semibold">
          Sellable Assets ({assets.length})
        </p>
        <div className="space-y-2">
          {assets.length === 0 && <p className="text-xs text-white/20">No assets listed.</p>}
          {assets.slice(0, 5).map((a, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${
                a.includedInWhatIf
                  ? 'bg-violet-500/10 border-violet-500/30'
                  : 'bg-white/[0.04] border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs">{a.includedInWhatIf ? '✅' : '⬜'}</span>
                <p className="text-sm text-white font-medium truncate">{a.name}</p>
              </div>
              <span className={`text-sm font-bold flex-shrink-0 ml-2 ${a.includedInWhatIf ? 'text-violet-400' : 'text-white/40'}`}>
                {formatCurrency(a.estimatedValue)}
              </span>
            </div>
          ))}
          {sellableAssets.length > 0 && (
            <div className="flex justify-between text-sm px-1 pt-1 border-t border-white/10">
              <span className="text-white/30">Selling total</span>
              <span className="text-violet-400 font-bold">{formatCurrency(assetTotal)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Presentation Mode ───────────────────────────────────────────────────
export default function PresentationMode({
  onClose,
  current,
  base,
  totalSavings,
  assetProceeds,
  hasWhatIf,
  expenses,
  subscriptions,
  investments,
  oneTimeExpenses,
  assets,
  unemployment,
  whatIf,
}) {
  const [slideIndex, setSlideIndex] = useState(0)
  const total = SLIDES.length

  const goNext = useCallback(() => setSlideIndex(i => Math.min(i + 1, total - 1)), [total])
  const goPrev = useCallback(() => setSlideIndex(i => Math.max(i - 1, 0)), [])
  const goTo   = useCallback((i) => setSlideIndex(i), [])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); goNext() }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')                    { e.preventDefault(); goPrev() }
      if (e.key === 'Escape')                                               { onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, onClose])

  const sharedProps = {
    current, base, totalSavings, assetProceeds, hasWhatIf,
    expenses, subscriptions, investments, oneTimeExpenses, assets, unemployment, whatIf,
  }

  const slideContent = {
    cover:     <SlideCover     {...sharedProps} />,
    chart:     <SlideChart     {...sharedProps} />,
    cashflow:  <SlideCashFlow  {...sharedProps} />,
    expenses:  <SlideExpenses  {...sharedProps} />,
    scenarios: <SlideScenarios {...sharedProps} />,
    actions:   <SlideActions   {...sharedProps} />,
  }

  const slide = SLIDES[slideIndex]

  // Accent colours per slide
  const SLIDE_ACCENTS = {
    cover:     '#3b82f6',
    chart:     '#6366f1',
    cashflow:  '#10b981',
    expenses:  '#f97316',
    scenarios: '#a78bfa',
    actions:   '#f59e0b',
  }
  const accent = SLIDE_ACCENTS[slide.id] || '#3b82f6'

  return (
    // Dark theatrical surround
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090f]">

      {/* ── Top chrome bar ── */}
      <div className="w-full flex-shrink-0 flex items-center justify-between px-6 py-2.5 border-b border-white/[0.06] bg-[#0c1018]">
        {/* Branding */}
        <div className="flex items-center gap-2.5">
          <span className="text-base">📊</span>
          <span className="text-xs font-medium text-white/50 tracking-wide">Financial Runway · Presentation</span>
        </div>

        {/* Slide tabs */}
        <div className="hidden lg:flex gap-1">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`text-xs px-3 py-1 rounded-md transition-all duration-150 ${
                i === slideIndex
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 transition-all"
        >
          <span>✕</span>
          <span className="hidden sm:inline">Exit</span>
          <kbd className="hidden sm:inline text-white/20 ml-1 font-mono">Esc</kbd>
        </button>
      </div>

      {/* ── 16:9 Slide container ── */}
      <div className="flex-1 w-full flex items-center justify-center p-6 min-h-0">
        {/* The slide itself — fixed 16:9 aspect ratio, max-width constrained */}
        <div
          className="w-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl border border-white/[0.07]"
          style={{
            aspectRatio: '16 / 9',
            background: 'linear-gradient(145deg, #0f172a 0%, #111827 60%, #0f1629 100%)',
            maxHeight: 'calc(100vh - 130px)',
          }}
        >
          <SlideFrame
            slideNum={slideIndex + 1}
            total={total}
            title={slide.title}
            accent={accent}
          >
            {slideContent[slide.id]}
          </SlideFrame>
        </div>
      </div>

      {/* ── Bottom chrome bar ── */}
      <div className="w-full flex-shrink-0 flex items-center justify-between px-6 py-2.5 border-t border-white/[0.06] bg-[#0c1018]">
        {/* Dot indicators */}
        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-200 rounded-full"
              style={{
                width: i === slideIndex ? 24 : 8,
                height: 8,
                background: i === slideIndex ? accent : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        {/* Keyboard hint */}
        <p className="text-xs text-white/20 hidden sm:block select-none">
          ← → &nbsp;navigate &nbsp;·&nbsp; Esc to exit
        </p>

        {/* Prev / Next */}
        <div className="flex gap-2">
          <button
            onClick={goPrev}
            disabled={slideIndex === 0}
            className="text-xs px-4 py-1.5 rounded-lg border border-white/10 text-white/40 hover:border-white/20 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          >
            ← Prev
          </button>
          <button
            onClick={goNext}
            disabled={slideIndex === total - 1}
            className="text-xs px-4 py-1.5 rounded-lg border text-white font-medium disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            style={{
              background: accent + '25',
              borderColor: accent + '60',
              color: slideIndex === total - 1 ? 'rgba(255,255,255,0.3)' : accent,
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
