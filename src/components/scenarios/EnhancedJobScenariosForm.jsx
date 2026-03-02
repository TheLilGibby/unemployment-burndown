import { useState } from 'react'
import dayjs from 'dayjs'
import { formatCurrency, formatMonths } from '../../utils/formatters'
import { US_STATES, getStateTaxRate, computeMonthlyTakeHome, computeAllocationAmount, computeMinimumGrossSalary } from '../../utils/stateTaxRates'
import CurrencyInput from '../finances/CurrencyInput'

const SCENARIO_COLORS = [
  '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
]
const MAX_SCENARIOS = 6
const today = dayjs('2026-02-21')
const minDate = today.add(1, 'day').format('YYYY-MM-DD')

export default function EnhancedJobScenariosForm({ scenarios, onChange, scenarioResults, effectiveExpenses = 0 }) {
  const [newName, setNewName] = useState('')
  const [newGross, setNewGross] = useState(0)
  const [newState, setNewState] = useState('')
  const [newTaxRate, setNewTaxRate] = useState(0)
  const [newStartDate, setNewStartDate] = useState('')
  const [newSavings, setNewSavings] = useState(0)
  const [newSavingsType, setNewSavingsType] = useState('dollar')
  const [newInvestment, setNewInvestment] = useState(0)
  const [newInvestmentType, setNewInvestmentType] = useState('dollar')
  const [newAnnualRaise, setNewAnnualRaise] = useState(3)
  // Compensation package state for new scenario form
  const [newSigningBonus, setNewSigningBonus] = useState(0)
  const [newAnnualBonusPct, setNewAnnualBonusPct] = useState(0)
  const [newBenefitsMonthly, setNewBenefitsMonthly] = useState(0)
  const [newEmployerMatch, setNewEmployerMatch] = useState(0)
  const [newEquityAnnual, setNewEquityAnnual] = useState(0)
  const [newCommuteMonthly, setNewCommuteMonthly] = useState(0)
  const [showNewCompPkg, setShowNewCompPkg] = useState(false)
  // Track which existing scenario cards have compensation package expanded
  const [showCompPkg, setShowCompPkg] = useState({})
  // Track which scenario cards are expanded (default: all collapsed)
  const [expandedCards, setExpandedCards] = useState({})

  function updateScenario(id, updates) {
    onChange(scenarios.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  function handleGrossChange(id, scenario, newGrossVal) {
    const takeHome = computeMonthlyTakeHome(newGrossVal, scenario.taxRatePct)
    updateScenario(id, { grossAnnualSalary: newGrossVal, monthlyTakeHome: takeHome })
  }

  function handleTaxRateChange(id, scenario, newRate) {
    const takeHome = computeMonthlyTakeHome(scenario.grossAnnualSalary, newRate)
    updateScenario(id, { taxRatePct: newRate, monthlyTakeHome: takeHome })
  }

  function handleStateChange(id, scenario, stateCode) {
    const suggestedRate = getStateTaxRate(stateCode)
    const takeHome = computeMonthlyTakeHome(scenario.grossAnnualSalary, suggestedRate)
    updateScenario(id, { usState: stateCode, taxRatePct: suggestedRate, monthlyTakeHome: takeHome })
  }

  function addScenario() {
    if (!newName.trim() || newGross <= 0 || !newStartDate) return
    const takeHome = computeMonthlyTakeHome(newGross, newTaxRate)
    const colorIndex = scenarios.length % SCENARIO_COLORS.length
    const newScenario = {
      id: Date.now(),
      name: newName.trim(),
      grossAnnualSalary: newGross,
      usState: newState,
      taxRatePct: newTaxRate,
      monthlyTakeHome: takeHome,
      startDate: newStartDate,
      color: SCENARIO_COLORS[colorIndex],
      savingsAllocation: newSavings,
      savingsAllocationType: newSavingsType,
      investmentAllocation: newInvestment,
      investmentAllocationType: newInvestmentType,
      annualRaisePct: newAnnualRaise,
      signingBonus: newSigningBonus,
      annualBonusPct: newAnnualBonusPct,
      employerBenefitsMonthly: newBenefitsMonthly,
      employer401kMatchPct: newEmployerMatch,
      equityAnnual: newEquityAnnual,
      commuteMonthly: newCommuteMonthly,
    }
    onChange([...scenarios, newScenario])
    setNewName('')
    setNewGross(0)
    setNewState('')
    setNewTaxRate(0)
    setNewStartDate('')
    setNewSavings(0)
    setNewSavingsType('dollar')
    setNewInvestment(0)
    setNewInvestmentType('dollar')
    setNewAnnualRaise(3)
    setNewSigningBonus(0)
    setNewAnnualBonusPct(0)
    setNewBenefitsMonthly(0)
    setNewEmployerMatch(0)
    setNewEquityAnnual(0)
    setNewCommuteMonthly(0)
    setShowNewCompPkg(false)
  }

  function removeScenario(id) {
    onChange(scenarios.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Existing scenario cards */}
      {scenarios.map(s => {
        const result = scenarioResults?.[s.id]
        const monthlyGross = (s.grossAnnualSalary || 0) / 12
        const monthlyTax = monthlyGross - s.monthlyTakeHome
        const savingsAmt = computeAllocationAmount(s.savingsAllocation, s.savingsAllocationType, s.monthlyTakeHome)
        const investAmt = computeAllocationAmount(s.investmentAllocation, s.investmentAllocationType, s.monthlyTakeHome)
        const spending = s.monthlyTakeHome - savingsAmt - investAmt
        const isExpanded = !!expandedCards[s.id]
        const netMonthly = s.monthlyTakeHome - effectiveExpenses
        const surplus = result ? s.monthlyTakeHome - result.effectiveExpenses : 0

        return (
          <div
            key={s.id}
            className="rounded-xl border"
            style={{ borderColor: s.color + '40', background: s.color + '08' }}
          >
            {/* Collapsed summary header - always visible */}
            <button
              type="button"
              onClick={() => setExpandedCards(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
              className="w-full text-left px-5 py-3 flex items-center gap-3 transition-colors rounded-xl"
              style={{ cursor: 'pointer' }}
            >
              <span
                className="flex-shrink-0 text-xs"
                style={{ color: 'var(--text-muted)', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
              >&#9654;</span>
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
              <span className="flex-shrink-0 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {formatCurrency(s.grossAnnualSalary)}/yr
              </span>
              <span className="flex-shrink-0 text-xs font-medium" style={{ color: 'var(--accent-emerald)' }}>
                {formatCurrency(s.monthlyTakeHome)}/mo
              </span>
              {result && (
                <span className="flex-shrink-0 text-xs font-medium" style={{ color: surplus >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                  {surplus >= 0 ? '+' : ''}{formatCurrency(surplus)}/mo
                </span>
              )}
              {result && (
                <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {result.runoutDate ? formatMonths(result.totalRunwayMonths) : '>10yr'}
                </span>
              )}
              <span className="ml-auto flex-shrink-0">
                <span
                  onClick={e => { e.stopPropagation(); removeScenario(s.id) }}
                  className="text-xs px-2 py-1 rounded border transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); removeScenario(s.id) } }}
                >
                  &times;
                </span>
              </span>
            </button>

            {/* Expanded detail form */}
            {isExpanded && (
              <div className="px-5 pb-5 pt-1 space-y-4 border-t" style={{ borderColor: s.color + '20' }}>
                {/* Header - editable name */}
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Name:</span>
                  <input
                    type="text"
                    value={s.name}
                    onChange={e => updateScenario(s.id, { name: e.target.value })}
                    className="flex-1 text-sm font-semibold bg-transparent border-none outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>

            {/* Row 1: Gross, State, Start Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Gross Annual Salary</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                  <CurrencyInput
                    value={s.grossAnnualSalary}
                    onChange={v => handleGrossChange(s.id, s, v)}
                    className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {formatCurrency(monthlyGross)}/mo gross
                </p>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>US State</label>
                <select
                  value={s.usState || ''}
                  onChange={e => handleStateChange(s.id, s, e.target.value)}
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                >
                  <option value="">Select state...</option>
                  {US_STATES.map(st => (
                    <option key={st.code} value={st.code}>{st.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Start Date</label>
                <input
                  type="date"
                  min={minDate}
                  value={s.startDate}
                  onChange={e => updateScenario(s.id, { startDate: e.target.value })}
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[1, 2, 3, 6].map(mo => {
                    const d = today.add(mo, 'month').format('YYYY-MM-DD')
                    return (
                      <button
                        key={mo}
                        onClick={() => updateScenario(s.id, { startDate: d })}
                        className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                        style={{
                          borderColor: s.startDate === d ? s.color : 'var(--border-subtle)',
                          background: s.startDate === d ? s.color + '20' : 'transparent',
                          color: s.startDate === d ? s.color : 'var(--text-faint)',
                        }}
                      >
                        +{mo}mo
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Row 2: Tax Rate, Take-Home */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Effective Tax Rate %</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  value={s.taxRatePct}
                  onChange={e => handleTaxRateChange(s.id, s, Number(e.target.value))}
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
                {s.usState && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    Suggested for {s.usState}: {getStateTaxRate(s.usState)}%
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Monthly Take-Home</label>
                <div
                  className="w-full text-sm rounded px-2 py-1.5 font-semibold"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--accent-emerald)' }}
                >
                  {formatCurrency(s.monthlyTakeHome)}/mo
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {formatCurrency(monthlyTax)}/mo taxes
                </p>
              </div>
            </div>

            {/* Row 3: Allocations */}
            <div className="grid grid-cols-2 gap-3">
              <AllocationField
                label="Savings Allocation"
                value={s.savingsAllocation}
                type={s.savingsAllocationType}
                onValueChange={v => updateScenario(s.id, { savingsAllocation: v })}
                onTypeChange={t => updateScenario(s.id, { savingsAllocationType: t })}
                resolvedAmount={savingsAmt}
                color="#f59e0b"
              />
              <AllocationField
                label="Investment Allocation"
                value={s.investmentAllocation}
                type={s.investmentAllocationType}
                onValueChange={v => updateScenario(s.id, { investmentAllocation: v })}
                onTypeChange={t => updateScenario(s.id, { investmentAllocationType: t })}
                resolvedAmount={investAmt}
                color="#a855f7"
              />
            </div>

            {/* Row 4: Annual Raise */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Annual Raise %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="25"
                    step="0.5"
                    value={s.annualRaisePct ?? 0}
                    onChange={e => updateScenario(s.id, { annualRaisePct: Number(e.target.value) })}
                    className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>%/yr</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[0, 2, 3, 5, 8].map(pct => (
                    <button
                      key={pct}
                      onClick={() => updateScenario(s.id, { annualRaisePct: pct })}
                      className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                      style={{
                        borderColor: (s.annualRaisePct ?? 0) === pct ? s.color : 'var(--border-subtle)',
                        background: (s.annualRaisePct ?? 0) === pct ? s.color + '20' : 'transparent',
                        color: (s.annualRaisePct ?? 0) === pct ? s.color : 'var(--text-faint)',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Year 5 Projected Salary</label>
                <div
                  className="w-full text-sm rounded px-2 py-1.5 font-semibold"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--accent-blue)' }}
                >
                  {formatCurrency(s.grossAnnualSalary * Math.pow(1 + (s.annualRaisePct ?? 0) / 100, 5))}/yr
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {formatCurrency(computeMonthlyTakeHome(s.grossAnnualSalary * Math.pow(1 + (s.annualRaisePct ?? 0) / 100, 5), s.taxRatePct))}/mo take-home
                </p>
              </div>
            </div>

            {/* Row 5: Compensation Package (collapsible) */}
            <div>
              <button
                onClick={() => setShowCompPkg(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                className="flex items-center gap-1.5 text-xs font-medium w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                <span style={{ display: 'inline-block', transform: showCompPkg[s.id] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>&#9654;</span>
                Compensation Package
                {(s.signingBonus > 0 || s.annualBonusPct > 0 || s.employerBenefitsMonthly > 0 ||
                  s.employer401kMatchPct > 0 || s.equityAnnual > 0 || s.commuteMonthly > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full ml-1" style={{ background: '#10b981', display: 'inline-block' }} />
                )}
              </button>
              {showCompPkg[s.id] && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Signing Bonus</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={s.signingBonus ?? 0}
                        onChange={v => updateScenario(s.id, { signingBonus: v })}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      net: {formatCurrency((s.signingBonus || 0) * (1 - s.taxRatePct / 100))}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Annual Bonus %</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" max="100" step="1"
                        value={s.annualBonusPct ?? 0}
                        onChange={e => updateScenario(s.id, { annualBonusPct: Number(e.target.value) })}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>%</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      = ~{formatCurrency(s.grossAnnualSalary * (s.annualBonusPct || 0) / 100 * (1 - s.taxRatePct / 100))}/yr net
                    </p>
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Benefits Value/mo</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={s.employerBenefitsMonthly ?? 0}
                        onChange={v => updateScenario(s.id, { employerBenefitsMonthly: v })}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>offsets insurance costs</p>
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>401k Match %</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={s.employer401kMatchPct ?? 0}
                        onChange={e => updateScenario(s.id, { employer401kMatchPct: Number(e.target.value) })}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>%</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      = ~{formatCurrency(s.grossAnnualSalary * (s.employer401kMatchPct || 0) / 100 / 12)}/mo to retirement
                    </p>
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Equity/RSU Annual</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={s.equityAnnual ?? 0}
                        onChange={v => updateScenario(s.id, { equityAnnual: v })}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      = {formatCurrency((s.equityAnnual || 0) / 12)}/mo vesting
                    </p>
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Commute Cost/mo</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={s.commuteMonthly ?? 0}
                        onChange={v => updateScenario(s.id, { commuteMonthly: v })}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>added to monthly expenses</p>
                  </div>
                </div>
              )}
            </div>

            {/* Net amount & minimum salary highlight */}
            {result && (() => {
              const minGross = computeMinimumGrossSalary(effectiveExpenses, s.taxRatePct)
              const meetsMinimum = s.grossAnnualSalary >= minGross

              return (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: s.color + '20' }}>
                  <div className="rounded-lg px-3 py-2" style={{ background: netMonthly >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${netMonthly >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Net Monthly</p>
                    <p className="text-base font-bold" style={{ color: netMonthly >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                      {netMonthly >= 0 ? '+' : ''}{formatCurrency(netMonthly)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>take-home minus expenses</p>
                  </div>
                  <div className="rounded-lg px-3 py-2" style={{ background: meetsMinimum ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${meetsMinimum ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Min Required Salary</p>
                    <p className="text-base font-bold" style={{ color: meetsMinimum ? 'var(--accent-emerald)' : '#f59e0b' }}>
                      {formatCurrency(minGross)}/yr
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                      {meetsMinimum ? 'salary covers expenses' : `need ${formatCurrency(minGross - s.grossAnnualSalary)} more/yr`}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Quick metrics */}
            {result && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1 border-t" style={{ borderColor: s.color + '20', color: 'var(--text-muted)' }}>
                <span>
                  Runway: <strong style={{ color: 'var(--text-primary)' }}>
                    {result.runoutDate ? formatMonths(result.totalRunwayMonths) : 'Beyond 10 yrs'}
                  </strong>
                </span>
                <span>
                  Surplus: <strong style={{ color: s.monthlyTakeHome > result.effectiveExpenses ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                    {formatCurrency(s.monthlyTakeHome - result.effectiveExpenses)}/mo
                  </strong>
                </span>
                <span>
                  Annual taxes: <strong style={{ color: 'var(--accent-red)' }}>{formatCurrency(monthlyTax * 12)}</strong>
                </span>
                <span>
                  Spending: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(spending)}/mo</strong>
                </span>
                {((s.signingBonus || 0) > 0 || (s.annualBonusPct || 0) > 0 || (s.equityAnnual || 0) > 0) && (
                  <span>
                    Total Comp (yr 1): <strong style={{ color: 'var(--accent-blue)' }}>
                      {formatCurrency(
                        s.grossAnnualSalary +
                        (s.signingBonus || 0) +
                        s.grossAnnualSalary * (s.annualBonusPct || 0) / 100 +
                        (s.equityAnnual || 0)
                      )}
                    </strong>
                  </span>
                )}
              </div>
            )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add new scenario form */}
      {scenarios.length < MAX_SCENARIOS ? (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Add a Scenario</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Company A - Sr Dev"
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Gross Annual Salary ($)</label>
              <CurrencyInput
                value={newGross}
                onChange={setNewGross}
                placeholder="e.g. 120,000"
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
              {newGross > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  Take-home: {formatCurrency(computeMonthlyTakeHome(newGross, newTaxRate))}/mo
                </p>
              )}
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Start Date</label>
              <input
                type="date"
                min={minDate}
                value={newStartDate}
                onChange={e => setNewStartDate(e.target.value)}
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>US State</label>
              <select
                value={newState}
                onChange={e => {
                  setNewState(e.target.value)
                  setNewTaxRate(getStateTaxRate(e.target.value))
                }}
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <option value="">Select state...</option>
                {US_STATES.map(st => (
                  <option key={st.code} value={st.code}>{st.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Tax Rate %</label>
              <input
                type="number"
                min="0"
                max="60"
                step="0.5"
                value={newTaxRate}
                onChange={e => setNewTaxRate(Number(e.target.value))}
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Annual Raise %</label>
              <input
                type="number"
                min="0"
                max="25"
                step="0.5"
                value={newAnnualRaise}
                onChange={e => setNewAnnualRaise(Number(e.target.value))}
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={addScenario}
                disabled={!newName.trim() || newGross <= 0 || !newStartDate}
                className="w-full text-xs px-4 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: 'var(--accent-emerald)',
                  background: 'var(--accent-emerald)' + '18',
                  color: 'var(--accent-emerald)',
                }}
              >
                + Add Scenario
              </button>
            </div>
          </div>

          {/* Compensation Package (collapsible) for new scenario */}
          <div>
            <button
              onClick={() => setShowNewCompPkg(prev => !prev)}
              className="flex items-center gap-1.5 text-xs font-medium w-full"
              style={{ color: 'var(--text-muted)' }}
            >
              <span style={{ display: 'inline-block', transform: showNewCompPkg ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>&#9654;</span>
              Compensation Package
              {(newSigningBonus > 0 || newAnnualBonusPct > 0 || newBenefitsMonthly > 0 ||
                newEmployerMatch > 0 || newEquityAnnual > 0 || newCommuteMonthly > 0) && (
                <span className="w-1.5 h-1.5 rounded-full ml-1" style={{ background: '#10b981', display: 'inline-block' }} />
              )}
            </button>
            {showNewCompPkg && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Signing Bonus</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                    <CurrencyInput
                      value={newSigningBonus}
                      onChange={setNewSigningBonus}
                      className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>one-time at start</p>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Annual Bonus %</label>
                  <input
                    type="number" min="0" max="100" step="1"
                    value={newAnnualBonusPct}
                    onChange={e => setNewAnnualBonusPct(Number(e.target.value))}
                    className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Benefits Value/mo</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                    <CurrencyInput
                      value={newBenefitsMonthly}
                      onChange={setNewBenefitsMonthly}
                      className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>offsets insurance costs</p>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>401k Match %</label>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    value={newEmployerMatch}
                    onChange={e => setNewEmployerMatch(Number(e.target.value))}
                    className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Equity/RSU Annual</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                    <CurrencyInput
                      value={newEquityAnnual}
                      onChange={setNewEquityAnnual}
                      className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Commute Cost/mo</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                    <CurrencyInput
                      value={newCommuteMonthly}
                      onChange={setNewCommuteMonthly}
                      className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Maximum of {MAX_SCENARIOS} scenarios reached. Remove one to add another.
        </p>
      )}

      {scenarios.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: 'var(--text-faint)' }}>
          Add a job scenario above to compare offers and see how each impacts your financial runway.
        </p>
      )}
    </div>
  )
}

function AllocationField({ label, value, type, onValueChange, onTypeChange, resolvedAmount, color }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="flex items-center gap-1">
        {type === 'dollar' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>}
        <input
          type="number"
          min="0"
          step={type === 'percent' ? 1 : 50}
          max={type === 'percent' ? 100 : undefined}
          value={value}
          onChange={e => onValueChange(Number(e.target.value))}
          className="flex-1 text-sm rounded px-2 py-1.5 focus:outline-none"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
        {type === 'percent' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>}
        {/* Toggle pill */}
        <div className="flex rounded-md overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={() => onTypeChange('dollar')}
            className="text-xs px-2 py-1 transition-colors"
            style={{
              background: type === 'dollar' ? color + '30' : 'var(--bg-input)',
              color: type === 'dollar' ? color : 'var(--text-faint)',
            }}
          >
            $
          </button>
          <button
            onClick={() => onTypeChange('percent')}
            className="text-xs px-2 py-1 transition-colors"
            style={{
              background: type === 'percent' ? color + '30' : 'var(--bg-input)',
              color: type === 'percent' ? color : 'var(--text-faint)',
            }}
          >
            %
          </button>
        </div>
      </div>
      {type === 'percent' && value > 0 && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
          = {formatCurrency(resolvedAmount)}/mo
        </p>
      )}
    </div>
  )
}
