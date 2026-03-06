import { useState, useEffect } from 'react'
import usePersistedState from '../../hooks/usePersistedState'
import dayjs from 'dayjs'
import { matchesPersonFilter } from '../../utils/personFilter'
import { getEffectivePayment } from '../../utils/ccPayment'

const COLOR_HEX = {
  blue:    '#3b82f6',
  purple:  '#a855f7',
  emerald: '#10b981',
  amber:   '#fbbf24',
  rose:    '#f43f5e',
  cyan:    '#06b6d4',
}

function getPersonColor(people, assignedTo) {
  if (!assignedTo || !people?.length) return null
  const p = people.find(x => x.id === assignedTo)
  return p ? (COLOR_HEX[p.color] ?? '#6b7280') : null
}

function fmt(n) {
  return '$' + Math.round(Math.abs(n)).toLocaleString()
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.15s ease',
        flexShrink: 0,
      }}
    >
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function Section({ label, total, sign, color, items = [], defaultOpen = false, persistKey = null }) {
  const [open, setOpen] = usePersistedState(persistKey, defaultOpen)
  const hasItems = items.length > 0

  return (
    <div>
      <button
        onClick={() => hasItems && setOpen(o => !o)}
        className="w-full flex items-center justify-between px-2 py-1 rounded-md transition-colors"
        style={{
          cursor: hasItems ? 'pointer' : 'default',
          background: open ? 'color-mix(in srgb, var(--bg-hover) 60%, transparent)' : 'transparent',
        }}
      >
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className="flex items-center gap-1 ml-1 shrink-0">
          <span className="text-xs font-semibold tabular-nums" style={{ color }}>
            {sign}{fmt(total)}
          </span>
          {hasItems && (
            <span style={{ color: 'var(--text-muted)' }}>
              <ChevronIcon open={open} />
            </span>
          )}
        </span>
      </button>

      {open && hasItems && (
        <div className="ml-2 mb-0.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-0.5 rounded">
              <span className="text-xs truncate" style={{ color: 'var(--text-muted)', opacity: 0.75, maxWidth: '60%' }}>
                {item.label}
              </span>
              <span className="flex items-center gap-1.5">
                {item.personColor && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.personColor, flexShrink: 0, display: 'inline-block' }} />
                )}
                <span className="text-xs tabular-nums" style={{ color, opacity: 0.85 }}>
                  {fmt(item.amount)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterBadge({ people, filterPersonId }) {
  if (!filterPersonId) return null
  if (filterPersonId === 'unassigned') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-dashed ml-1" style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}>
        Unassigned
      </span>
    )
  }
  const person = people.find(p => p.id === filterPersonId)
  if (!person) return null
  const hex = COLOR_HEX[person.color] ?? '#6b7280'
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-semibold" style={{ background: `color-mix(in srgb, ${hex} 20%, transparent)`, color: hex }}>
      {person.name}
    </span>
  )
}

function MobileFinancialDrawer({
  runwayLabel, runwayColor, burnColor, currentNetBurn, fmt,
  totalSavings, assetProceeds, monthlyBenefits, monthlyInvestments,
  totalMonthlyIncome, upcomingOneTimeIncome, totalExpensesOnly, totalSubsCost,
  totalCCPayments, upcomingOneTimeExpenses, activeAccounts, activeSubscriptions,
  activeCCPayments, activeInvestments, expenses, monthlyIncome, unemployment,
  oneTimeExpenses, oneTimeIncome, upcomingOneTimePurchases = [], activeJobs = [], totalJobIncome = 0, people = [], filterPersonId = null,
  adCosts = [], totalAdCosts = 0, adRevenue = [], totalAdRevenue = 0,
}) {
  const [open, setOpen] = useState(false)

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Peek height: 3.5rem handle + safe area
  const peekHeight = 'calc(3.5rem + env(safe-area-inset-bottom, 0px))'

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="xl:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom drawer — uses max-height instead of transform so it's always
          visible at the bottom regardless of content height or dvh support */}
      <div
        className="xl:hidden flex flex-col fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderBottom: 'none',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
          transition: 'max-height 0.35s cubic-bezier(0.32,0.72,0,1)',
          maxHeight: open ? '80vh' : peekHeight,
          overflow: 'hidden',
        }}
      >
        {/* Handle / collapsed pill */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 shrink-0"
          style={{
            height: peekHeight,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
          aria-label={open ? 'Close financial summary' : 'Open financial summary'}
        >
          {/* Drag handle */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-8 h-1 rounded-full" style={{ background: 'var(--border-default)' }} />

          <span className="flex items-center text-xs font-semibold uppercase tracking-widest flex-1 min-w-0" style={{ color: 'var(--text-muted)' }}>
            Finances
            <FilterBadge people={people} filterPersonId={filterPersonId} />
          </span>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-xs tabular-nums" style={{ color: burnColor }}>
              {currentNetBurn > 0 ? '-' : '+'}{fmt(currentNetBurn)}/mo
            </span>
            <span className="text-sm font-bold tabular-nums" style={{ color: runwayColor }}>
              {runwayLabel}
            </span>
            <svg
              width="12" height="12" viewBox="0 0 10 10" fill="none"
              style={{
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                color: 'var(--text-muted)',
              }}
            >
              <path d="M2 6.5L5 3.5L8 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>

        {/* Scrollable content — flex-1 + min-h-0 allows proper scroll within flex column */}
        <div className="flex-1 min-h-0 flex flex-col gap-0.5 overflow-y-auto px-3" style={{ scrollbarWidth: 'none', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
          {/* Cash */}
          <Section label="Cash" total={totalSavings} sign="" color="var(--accent-blue)" persistKey="burndown_collapse_fin_cash"
            items={activeAccounts.map(a => ({ label: a.name || 'Account', amount: Number(a.amount) || 0, personColor: getPersonColor(people, a.assignedTo) }))} />

          {assetProceeds > 0 && (
            <Section label="Assets (if sold)" total={assetProceeds} sign="+" color="var(--accent-teal)" persistKey="burndown_collapse_fin_assets" items={[]} />
          )}

          <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--border-default)' }} />
          <p className="text-xs px-2 mb-0.5" style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Income /mo</p>

          {monthlyBenefits > 0 && (
            <Section label="UI Benefits" total={monthlyBenefits} sign="+" color="var(--accent-emerald)" persistKey="burndown_collapse_fin_ui_benefits"
              items={[{ label: unemployment.weeklyAmount ? `$${unemployment.weeklyAmount}/wk` : '', amount: monthlyBenefits }].filter(i => i.label)} />
          )}

          {totalJobIncome > 0 && (
            <Section label="Job Income" total={totalJobIncome} sign="+" color="var(--accent-emerald)" persistKey="burndown_collapse_fin_job_income"
              items={activeJobs.map(j => ({ label: j.title || j.employer || 'Job', amount: Number(j.monthlySalary) || 0, personColor: getPersonColor(people, j.assignedTo) }))} />
          )}

          {totalMonthlyIncome > 0 && (
            <Section label="Monthly Income" total={totalMonthlyIncome} sign="+" color="var(--accent-emerald)" persistKey="burndown_collapse_fin_monthly_income"
              items={monthlyIncome.filter(x => x.monthlyAmount).map(x => ({ label: x.name || x.source || 'Income', amount: Number(x.monthlyAmount) || 0, personColor: getPersonColor(people, x.assignedTo) }))} />
          )}

          {upcomingOneTimeIncome.length > 0 && (
            <Section label="One-Time Income" total={upcomingOneTimeIncome.reduce((s, x) => s + (Number(x.amount) || 0), 0)} sign="+" color="var(--accent-teal)" persistKey="burndown_collapse_fin_onetime_income"
              items={upcomingOneTimeIncome.map(x => ({ label: x.note || x.description || x.date || 'Income', amount: Number(x.amount) || 0, personColor: getPersonColor(people, x.assignedTo) }))} />
          )}

          {totalAdRevenue > 0 && (
            <Section label="Ad Revenue" total={totalAdRevenue} sign="+" color="var(--accent-emerald)" persistKey="burndown_collapse_fin_ad_revenue"
              items={adRevenue.filter(r => r.monthlyAmount).map(r => ({ label: r.description || 'Ad Revenue', amount: Number(r.monthlyAmount) || 0, personColor: getPersonColor(people, r.assignedTo) }))} />
          )}

          <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--border-default)' }} />
          <p className="text-xs px-2 mb-0.5" style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Expenses /mo</p>

          {totalExpensesOnly > 0 && (
            <Section label="Expenses" total={totalExpensesOnly} sign="-" color="var(--accent-red)" persistKey="burndown_collapse_fin_expenses"
              items={expenses.filter(e => e.monthlyAmount).map(e => ({ label: e.category || 'Expense', amount: Number(e.monthlyAmount) || 0, personColor: getPersonColor(people, e.assignedTo) }))} />
          )}

          {totalSubsCost > 0 && (
            <Section label="Subscriptions" total={totalSubsCost} sign="-" color="var(--accent-red)" persistKey="burndown_collapse_fin_subscriptions"
              items={activeSubscriptions.map(s => ({ label: s.name || 'Sub', amount: Number(s.monthlyAmount) || 0, personColor: getPersonColor(people, s.assignedTo) }))} />
          )}

          {totalCCPayments > 0 && (
            <Section label="CC Payments" total={totalCCPayments} sign="-" color="var(--accent-amber)" persistKey="burndown_collapse_fin_cc_payments"
              items={activeCCPayments.map(c => ({ label: c.name || 'Card', amount: getEffectivePayment(c), personColor: getPersonColor(people, c.assignedTo) }))} />
          )}

          {monthlyInvestments > 0 && (
            <Section label="Investments" total={monthlyInvestments} sign="-" color="var(--accent-amber)" persistKey="burndown_collapse_fin_investments"
              items={activeInvestments.map(inv => ({ label: inv.name || inv.type || 'Investment', amount: Number(inv.monthlyAmount) || 0, personColor: getPersonColor(people, inv.assignedTo) }))} />
          )}

          {totalAdCosts > 0 && (
            <Section label="Ad Costs" total={totalAdCosts} sign="-" color="var(--accent-red)" persistKey="burndown_collapse_fin_ad_costs"
              items={adCosts.filter(c => c.monthlyAmount).map(c => ({ label: c.description || 'Ad Cost', amount: Number(c.monthlyAmount) || 0, personColor: getPersonColor(people, c.assignedTo) }))} />
          )}

          {upcomingOneTimeExpenses.length > 0 && (
            <Section label="One-Time Expenses" total={upcomingOneTimeExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)} sign="-" color="var(--accent-red)" persistKey="burndown_collapse_fin_onetime_expenses"
              items={upcomingOneTimeExpenses.map(e => ({ label: e.note || e.category || e.date || 'Expense', amount: Number(e.amount) || 0, personColor: getPersonColor(people, e.assignedTo) }))} />
          )}

          {upcomingOneTimePurchases.length > 0 && (
            <Section label="Purchases" total={upcomingOneTimePurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0)} sign="-" color="var(--accent-red)" persistKey="burndown_collapse_fin_purchases"
              items={upcomingOneTimePurchases.map(p => ({ label: `${p.description || 'Purchase'}${p.medium ? ` (${p.medium})` : ''}`, amount: Number(p.amount) || 0, personColor: getPersonColor(people, p.assignedTo) }))} />
          )}

          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Net Burn</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: burnColor }}>
                {currentNetBurn > 0 ? '-' : '+'}{fmt(currentNetBurn)}/mo
              </span>
            </div>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Runway</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: runwayColor }}>
                {runwayLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function FinancialSidebar({
  totalSavings = 0,
  assetProceeds = 0,
  effectiveExpenses = 0,
  monthlyBenefits = 0,
  monthlyInvestments = 0,
  currentNetBurn = 0,
  totalRunwayMonths = null,
  // raw data for breakdowns
  savingsAccounts = [],
  expenses = [],
  subscriptions = [],
  creditCards = [],
  investments = [],
  oneTimeExpenses = [],
  oneTimePurchases = [],
  oneTimeIncome = [],
  monthlyIncome = [],
  unemployment = {},
  jobs = [],
  people = [],
  filterPersonId = null,
  advertisingRevenue = { costs: [], revenue: [] },
}) {
  // Apply person filter to all data arrays
  const pf = filterPersonId
  const fp = (item) => matchesPersonFilter(item.assignedTo, pf)

  const filteredAccounts = pf ? savingsAccounts.filter(fp) : savingsAccounts
  const filteredExpenses = pf ? expenses.filter(fp) : expenses
  const filteredSubscriptions = pf ? subscriptions.filter(fp) : subscriptions
  const filteredCreditCards = pf ? creditCards.filter(fp) : creditCards
  const filteredInvestments = pf ? investments.filter(fp) : investments
  const filteredOneTimeExpenses = pf ? oneTimeExpenses.filter(fp) : oneTimeExpenses
  const filteredOneTimePurchases = pf ? oneTimePurchases.filter(fp) : oneTimePurchases
  const filteredOneTimeIncome = pf ? oneTimeIncome.filter(fp) : oneTimeIncome
  const filteredMonthlyIncome = pf ? monthlyIncome.filter(fp) : monthlyIncome

  // Show UI benefits only if unemployment is assigned to the filtered person (or no filter / unassigned)
  const showBenefits = !pf || matchesPersonFilter(unemployment.assignedTo, pf)

  const activeAccounts = filteredAccounts.filter(a => a.active !== false)
  const activeSubscriptions = filteredSubscriptions.filter(s => s.active !== false)
  const activeCCPayments = filteredCreditCards.filter(c => getEffectivePayment(c) > 0)
  const activeInvestments = filteredInvestments.filter(inv => inv.active !== false && (Number(inv.monthlyAmount) || 0) > 0)

  const fTotalSavings = activeAccounts.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const totalSubsCost = activeSubscriptions.reduce((s, x) => s + (Number(x.monthlyAmount) || 0), 0)
  const totalCCPayments = activeCCPayments.reduce((s, c) => s + getEffectivePayment(c), 0)
  const totalExpensesOnly = filteredExpenses.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)
  const totalMonthlyIncome = filteredMonthlyIncome.reduce((s, x) => s + (Number(x.monthlyAmount) || 0), 0)
  const fMonthlyInvestments = activeInvestments.reduce((s, inv) => s + (Number(inv.monthlyAmount) || 0), 0)
  const upcomingOneTimeExpenses = filteredOneTimeExpenses.filter(e => e.date && e.amount)
  const upcomingOneTimePurchases = filteredOneTimePurchases.filter(p => p.date && p.amount)
  const upcomingOneTimeIncome = filteredOneTimeIncome.filter(e => e.date && e.amount)

  const fMonthlyBenefits = showBenefits ? monthlyBenefits : 0

  // Advertising items (filter by person if active)
  const adCosts = (advertisingRevenue?.costs ?? []).filter(c => !pf || matchesPersonFilter(c.assignedTo, pf))
  const adRevenue = (advertisingRevenue?.revenue ?? []).filter(r => !pf || matchesPersonFilter(r.assignedTo, pf))
  const totalAdCosts = adCosts.reduce((s, c) => s + (Number(c.monthlyAmount) || 0), 0)
  const totalAdRevenue = adRevenue.reduce((s, r) => s + (Number(r.monthlyAmount) || 0), 0)

  // Filtered net burn
  const fTotalExpenses = totalExpensesOnly + totalSubsCost + totalCCPayments + fMonthlyInvestments + totalAdCosts
  const fTotalIncome = fMonthlyBenefits + totalMonthlyIncome + totalAdRevenue
  const fNetBurn = pf ? (fTotalExpenses - fTotalIncome) : currentNetBurn

  // Use unfiltered values when no filter is active
  const displaySavings = pf ? fTotalSavings : totalSavings
  const displayBenefits = pf ? fMonthlyBenefits : monthlyBenefits
  const displayInvestments = pf ? fMonthlyInvestments : monthlyInvestments
  const displayNetBurn = fNetBurn

  const runwayLabel = pf
    ? (displayNetBurn <= 0
      ? '10+ yrs'
      : displaySavings > 0
        ? (() => { const m = displaySavings / displayNetBurn; return m >= 120 ? '10+ yrs' : m >= 24 ? `${(m / 12).toFixed(1)} yrs` : `${Math.round(m)} mo` })()
        : '0 mo')
    : totalRunwayMonths != null
      ? totalRunwayMonths >= 120
        ? '10+ yrs'
        : totalRunwayMonths >= 24
          ? `${(totalRunwayMonths / 12).toFixed(1)} yrs`
          : `${Math.round(totalRunwayMonths)} mo`
      : '—'

  const runwayMonths = pf
    ? (displayNetBurn <= 0 ? 120 : displaySavings > 0 ? displaySavings / displayNetBurn : 0)
    : totalRunwayMonths

  const runwayColor = runwayMonths == null
    ? 'var(--text-muted)'
    : runwayMonths >= 18
      ? 'var(--accent-emerald)'
      : runwayMonths >= 9
        ? 'var(--accent-amber)'
        : 'var(--accent-red)'

  const burnColor = displayNetBurn > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'

  const filteredJobs = pf ? jobs.filter(fp) : jobs
  const today = dayjs()
  const activeJobs = filteredJobs.filter(j => {
    if ((Number(j.monthlySalary) || 0) <= 0) return false
    if (j.endDate && dayjs(j.endDate).isBefore(today)) return false
    if (!j.endDate && j.status !== 'active') return false
    return true
  })
  const totalJobIncome = activeJobs.reduce((s, j) => s + (Number(j.monthlySalary) || 0), 0)

  return (
    <>
    <MobileFinancialDrawer
      runwayLabel={runwayLabel}
      runwayColor={runwayColor}
      burnColor={burnColor}
      currentNetBurn={displayNetBurn}
      fmt={fmt}
      totalSavings={displaySavings}
      assetProceeds={pf ? 0 : assetProceeds}
      monthlyBenefits={displayBenefits}
      monthlyInvestments={displayInvestments}
      totalMonthlyIncome={totalMonthlyIncome}
      upcomingOneTimeIncome={upcomingOneTimeIncome}
      totalExpensesOnly={totalExpensesOnly}
      totalSubsCost={totalSubsCost}
      totalCCPayments={totalCCPayments}
      upcomingOneTimeExpenses={upcomingOneTimeExpenses}
      upcomingOneTimePurchases={upcomingOneTimePurchases}
      activeAccounts={activeAccounts}
      activeSubscriptions={activeSubscriptions}
      activeCCPayments={activeCCPayments}
      activeInvestments={activeInvestments}
      expenses={filteredExpenses}
      monthlyIncome={filteredMonthlyIncome}
      unemployment={unemployment}
      oneTimeExpenses={filteredOneTimeExpenses}
      oneTimeIncome={filteredOneTimeIncome}
      activeJobs={activeJobs}
      totalJobIncome={totalJobIncome}
      people={people}
      filterPersonId={filterPersonId}
      adCosts={adCosts}
      totalAdCosts={totalAdCosts}
      adRevenue={adRevenue}
      totalAdRevenue={totalAdRevenue}
    />
    <aside
      className="hidden xl:flex flex-col fixed z-40 rounded-xl"
      style={{
        top: '5.5rem',
        right: '0.75rem',
        width: '11rem',
        maxHeight: 'calc(100vh - 7rem)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
        padding: '0.5rem 0',
      }}
      aria-label="Financial summary"
    >
      <p className="flex items-center text-xs font-semibold uppercase tracking-widest mb-2 px-2 shrink-0" style={{ color: 'var(--text-muted)' }}>
        Finances
        <FilterBadge people={people} filterPersonId={filterPersonId} />
      </p>

      {/* Scrollable sections */}
      <div className="flex flex-col gap-0.5 overflow-y-auto min-h-0 pb-2" style={{ scrollbarWidth: 'none' }}>

        {/* Cash */}
        <Section
          label="Cash"
          total={displaySavings}
          sign=""
          color="var(--accent-blue)"
          defaultOpen={false}
          items={activeAccounts.map(a => ({ label: a.name || 'Account', amount: Number(a.amount) || 0, personColor: getPersonColor(people, a.assignedTo) }))}
        />

        {/* Asset Proceeds */}
        {!pf && assetProceeds > 0 && (
          <Section
            label="Assets (if sold)"
            total={assetProceeds}
            sign="+"
            color="var(--accent-teal)"
            items={[]}
          />
        )}

        {/* Divider: Income */}
        <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--border-default)' }} />
        <p className="text-xs px-2 mb-0.5" style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Income /mo</p>

        {/* UI Benefits */}
        {displayBenefits > 0 && (
          <Section
            label="UI Benefits"
            total={displayBenefits}
            sign="+"
            color="var(--accent-emerald)"
            items={[
              { label: `${unemployment.weeklyAmount ? '$' + unemployment.weeklyAmount + '/wk' : ''}`, amount: displayBenefits },
            ].filter(i => i.label)}
          />
        )}

        {/* Job Income */}
        {totalJobIncome > 0 && (
          <Section
            label="Job Income"
            total={totalJobIncome}
            sign="+"
            color="var(--accent-emerald)"
            items={activeJobs.map(j => ({ label: j.title || j.employer || 'Job', amount: Number(j.monthlySalary) || 0, personColor: getPersonColor(people, j.assignedTo) }))}
          />
        )}

        {/* Monthly Income */}
        {totalMonthlyIncome > 0 && (
          <Section
            label="Monthly Income"
            total={totalMonthlyIncome}
            sign="+"
            color="var(--accent-emerald)"
            items={filteredMonthlyIncome.filter(x => x.monthlyAmount).map(x => ({ label: x.name || x.source || 'Income', amount: Number(x.monthlyAmount) || 0, personColor: getPersonColor(people, x.assignedTo) }))}
          />
        )}

        {/* One-time Income */}
        {upcomingOneTimeIncome.length > 0 && (
          <Section
            label="One-Time Income"
            total={upcomingOneTimeIncome.reduce((s, x) => s + (Number(x.amount) || 0), 0)}
            sign="+"
            color="var(--accent-teal)"
            items={upcomingOneTimeIncome.map(x => ({ label: x.note || x.description || x.date || 'Income', amount: Number(x.amount) || 0, personColor: getPersonColor(people, x.assignedTo) }))}
          />
        )}

        {/* Ad Revenue */}
        {totalAdRevenue > 0 && (
          <Section
            label="Ad Revenue"
            total={totalAdRevenue}
            sign="+"
            color="var(--accent-emerald)"
            items={adRevenue.filter(r => r.monthlyAmount).map(r => ({ label: r.description || 'Ad Revenue', amount: Number(r.monthlyAmount) || 0, personColor: getPersonColor(people, r.assignedTo) }))}
          />
        )}

        {/* Divider: Expenses */}
        <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--border-default)' }} />
        <p className="text-xs px-2 mb-0.5" style={{ color: 'var(--text-muted)', opacity: 0.5, fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Expenses /mo</p>

        {/* Core Expenses */}
        {totalExpensesOnly > 0 && (
          <Section
            label="Expenses"
            total={totalExpensesOnly}
            sign="-"
            color="var(--accent-red)"
            items={filteredExpenses.filter(e => e.monthlyAmount).map(e => ({ label: e.category || 'Expense', amount: Number(e.monthlyAmount) || 0, personColor: getPersonColor(people, e.assignedTo) }))}
          />
        )}

        {/* Subscriptions */}
        {totalSubsCost > 0 && (
          <Section
            label="Subscriptions"
            total={totalSubsCost}
            sign="-"
            color="var(--accent-red)"
            items={activeSubscriptions.map(s => ({ label: s.name || 'Sub', amount: Number(s.monthlyAmount) || 0, personColor: getPersonColor(people, s.assignedTo) }))}
          />
        )}

        {/* Credit Cards */}
        {totalCCPayments > 0 && (
          <Section
            label="CC Payments"
            total={totalCCPayments}
            sign="-"
            color="var(--accent-amber)"
            items={activeCCPayments.map(c => ({ label: c.name || 'Card', amount: getEffectivePayment(c), personColor: getPersonColor(people, c.assignedTo) }))}
          />
        )}

        {/* Investments */}
        {displayInvestments > 0 && (
          <Section
            label="Investments"
            total={displayInvestments}
            sign="-"
            color="var(--accent-amber)"
            items={activeInvestments.map(inv => ({ label: inv.name || inv.type || 'Investment', amount: Number(inv.monthlyAmount) || 0, personColor: getPersonColor(people, inv.assignedTo) }))}
          />
        )}

        {/* Ad Costs */}
        {totalAdCosts > 0 && (
          <Section
            label="Ad Costs"
            total={totalAdCosts}
            sign="-"
            color="var(--accent-red)"
            items={adCosts.filter(c => c.monthlyAmount).map(c => ({ label: c.description || 'Ad Cost', amount: Number(c.monthlyAmount) || 0, personColor: getPersonColor(people, c.assignedTo) }))}
          />
        )}

        {/* One-time Expenses */}
        {upcomingOneTimeExpenses.length > 0 && (
          <Section
            label="One-Time Expenses"
            total={upcomingOneTimeExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)}
            sign="-"
            color="var(--accent-red)"
            items={upcomingOneTimeExpenses.map(e => ({ label: e.note || e.category || e.date || 'Expense', amount: Number(e.amount) || 0, personColor: getPersonColor(people, e.assignedTo) }))}
          />
        )}

        {/* One-time Purchases */}
        {upcomingOneTimePurchases.length > 0 && (
          <Section
            label="Purchases"
            total={upcomingOneTimePurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0)}
            sign="-"
            color="var(--accent-red)"
            items={upcomingOneTimePurchases.map(p => ({ label: `${p.description || 'Purchase'}${p.medium ? ` (${p.medium})` : ''}`, amount: Number(p.amount) || 0, personColor: getPersonColor(people, p.assignedTo) }))}
          />
        )}
      </div>

      {/* Pinned footer: Net Burn + Runway */}
      <div className="shrink-0 mt-1 pt-1.5" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between px-2 py-0.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Net Burn</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: burnColor }}>
            {displayNetBurn > 0 ? '-' : '+'}{fmt(displayNetBurn)}/mo
          </span>
        </div>
        <div className="flex items-center justify-between px-2 py-0.5">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Runway</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: runwayColor }}>
            {runwayLabel}
          </span>
        </div>
      </div>
    </aside>
    </>
  )
}
