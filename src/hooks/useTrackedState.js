import { useRef, useState } from 'react'
import dayjs from 'dayjs'
import { diffArray, diffObject, diffPrimitive } from '../utils/diffSection'
import { getEffectivePayment } from '../utils/ccPayment'

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
const _fmtM = (n) => '$' + Math.round(Math.abs(n)).toLocaleString()
const _activeSum = (arr, key) =>
  _fmtM(arr.filter(a => a.active !== false).reduce((s, a) => s + (Number(a[key]) || 0), 0))
const _allSum = (arr, key) =>
  _fmtM(arr.reduce((s, a) => s + (Number(a[key]) || 0), 0))

// ---------------------------------------------------------------------------
// Summarizers — convert state to a short display string for before/after logs
// ---------------------------------------------------------------------------
const summarizeSavings = (v) => _activeSum(v, 'amount')
const summarizeExpenses = (v) => _allSum(v, 'monthlyAmount') + '/mo'
const summarizeUnemployment = (v) => `$${v.weeklyAmount || 0}/wk × ${v.durationWeeks || 0}wks`
const summarizeFurlough = (v) => v || 'not set'
const summarizePeople = (v) => `${v.length} person${v.length !== 1 ? 's' : ''}`
const summarizeWhatIf = (v) => {
  const parts = []
  if (v.expenseReductionPct)                        parts.push(`${v.expenseReductionPct}% cut`)
  if (v.expenseRaisePct)                            parts.push(`+${v.expenseRaisePct}% raise`)
  if (v.sideIncomeMonthly)                          parts.push(`+${_fmtM(v.sideIncomeMonthly)}/mo side`)
  if (v.partnerIncomeMonthly && v.partnerStartDate) parts.push(`partner ${_fmtM(v.partnerIncomeMonthly)}/mo`)
  if (v.emergencyFloor)                             parts.push(`floor ${_fmtM(v.emergencyFloor)}`)
  return parts.length ? parts.join(', ') : 'baseline'
}
const summarizeOneTimeExp = (v) => `${v.length} item${v.length !== 1 ? 's' : ''} · ${_allSum(v, 'amount')}`
const summarizeOneTimePurch = (v) => `${v.length} item${v.length !== 1 ? 's' : ''} · ${_allSum(v, 'amount')}`
const summarizeOneTimeInc = (v) => `${v.length} item${v.length !== 1 ? 's' : ''} · ${_allSum(v, 'amount')}`
const summarizeMonthlyInc = (v) => _allSum(v, 'monthlyAmount') + '/mo'
const summarizeJobs = (v) => {
  const now = dayjs()
  const isActive = (j) => {
    if (j.endDate && dayjs(j.endDate).isBefore(now)) return false
    if (!j.endDate && j.status !== 'active') return false
    return true
  }
  const active = v.filter(isActive).length
  const totalSalary = v.filter(isActive).reduce((s, j) => s + (Number(j.monthlySalary) || 0), 0)
  return `${active} active · ${_fmtM(totalSalary)}/mo`
}
const summarizeAssets = (v) => `${v.length} asset${v.length !== 1 ? 's' : ''}`
const summarizeInvestments = (v) => _activeSum(v, 'monthlyAmount') + '/mo'
const summarizeSubs = (v) => _activeSum(v, 'monthlyAmount') + '/mo'
const summarizeCCs = (v) => {
  const total = v.reduce((s, c) => s + getEffectivePayment(c), 0)
  return _fmtM(total) + '/mo'
}
const summarizeAdvertisingRevenue = (v) => {
  const costTotal = (v?.costs || []).reduce((s, c) => s + (Number(c.monthlyAmount) || 0), 0)
  const revTotal  = (v?.revenue || []).reduce((s, r) => s + (Number(r.monthlyAmount) || 0), 0)
  return `spend ${_fmtM(costTotal)}/mo · revenue ${_fmtM(revTotal)}/mo`
}
const summarizeJobScenarios = (v) => `${v.length} scenario${v.length !== 1 ? 's' : ''}`
const summarizeProperties = (v) => `${v.length} propert${v.length !== 1 ? 'ies' : 'y'}`
const summarizeHomeImprovements = (v) => `${v.length} item${v.length !== 1 ? 's' : ''} · ${_allSum(v, 'amount')}`
const summarizeRetirement = (v) => {
  const target = v.targetMode === 'income'
    ? Math.round((Number(v.desiredAnnualIncome) || 0) / ((Number(v.withdrawalRatePct) || 4) / 100))
    : Number(v.targetNestEgg) || 0
  return `age ${v.currentAge}→${v.targetRetirementAge}, target ${_fmtM(target)}, ${_fmtM(v.monthlyContribution)}/mo`
}
const summarizeGoals = (v) => `${v.length} goal${v.length !== 1 ? 's' : ''}`

// ---------------------------------------------------------------------------
// Tracking configuration — maps each section name to its summarizer + diff fn
// ---------------------------------------------------------------------------
const TRACKED_SECTIONS = {
  savingsAccounts:      { label: 'Cash & savings',      summarize: summarizeSavings,             diff: diffArray },
  expenses:             { label: 'Monthly expenses',    summarize: summarizeExpenses,            diff: diffArray },
  unemployment:         { label: 'Unemployment',        summarize: summarizeUnemployment,        diff: diffObject },
  furloughDate:         { label: 'Furlough date',       summarize: summarizeFurlough,            diff: diffPrimitive },
  people:               { label: 'People',              summarize: summarizePeople,              diff: diffArray },
  whatIf:               { label: 'What-if scenarios',   summarize: summarizeWhatIf,              diff: diffObject },
  oneTimeExpenses:      { label: 'One-time expenses',   summarize: summarizeOneTimeExp,          diff: diffArray },
  oneTimePurchases:     { label: 'One-time purchases',  summarize: summarizeOneTimePurch,        diff: diffArray },
  oneTimeIncome:        { label: 'One-time income',     summarize: summarizeOneTimeInc,          diff: diffArray },
  monthlyIncome:        { label: 'Monthly income',      summarize: summarizeMonthlyInc,          diff: diffArray },
  jobs:                 { label: 'Jobs',                summarize: summarizeJobs,                diff: diffArray },
  assets:               { label: 'Assets',              summarize: summarizeAssets,              diff: diffArray },
  investments:          { label: 'Investments',         summarize: summarizeInvestments,         diff: diffArray },
  child1Investments:    { label: 'Child [1] Investments', summarize: summarizeInvestments,       diff: diffArray },
  child2Investments:    { label: 'Child [2] Investments', summarize: summarizeInvestments,       diff: diffArray },
  subscriptions:        { label: 'Subscriptions',       summarize: summarizeSubs,                diff: diffArray },
  creditCards:          { label: 'Credit cards',        summarize: summarizeCCs,                 diff: diffArray },
  jobScenarios:         { label: 'Job scenarios',       summarize: summarizeJobScenarios,        diff: diffArray },
  retirement:           { label: 'Retirement plan',     summarize: summarizeRetirement,          diff: diffObject },
  properties:           { label: 'Properties',          summarize: summarizeProperties,          diff: diffArray },
  homeImprovements:     { label: 'Home improvements',   summarize: summarizeHomeImprovements,    diff: diffArray },
  goals:                { label: 'Goals',               summarize: summarizeGoals,               diff: diffArray },
  advertisingRevenue:   { label: 'Advertising revenue', summarize: summarizeAdvertisingRevenue,  diff: diffObject },
}

/**
 * Hook that wraps a collection of setters with change-tracking:
 * - Logs before/after summaries + granular diffs via addEntry
 * - Marks sections dirty for auto-save
 * - Tracks hasDirtyChanges for unsaved-changes warning
 *
 * @param {object} stateMap  { sectionName: [value, setter] } from the state hook
 * @param {function} addEntry  from useActivityLog
 * @returns {{ tracked, dirtySections, hasDirtyChanges, setHasDirtyChanges }}
 */
export function useTrackedState(stateMap, addEntry) {
  const dirtySections = useRef(new Set())
  const [hasDirtyChanges, setHasDirtyChanges] = useState(false)

  // Build tracked change handlers
  const tracked = {}
  for (const [key, [_value, setter]] of Object.entries(stateMap)) {
    const config = TRACKED_SECTIONS[key]
    if (!config) {
      // No tracking config — just pass through the setter
      tracked[key] = setter
      continue
    }
    // We need a stable reference to the current value for the "before" snapshot.
    // The stateMap is rebuilt each render, so the closure captures the latest value.
    const { label, summarize, diff: diffFn } = config
    tracked[key] = (v) => {
      const [currentVal] = stateMap[key]
      try {
        const before = summarize ? summarize(currentVal) : null
        const after  = summarize ? summarize(v)          : null
        const details = diffFn ? diffFn(currentVal, v) : []
        if (before !== after || details.length > 0) {
          addEntry('change', label, { before, after, details })
        }
      } catch { /* ignore summary errors */ }
      setter(v)
      dirtySections.current.add(label)
      setHasDirtyChanges(true)
    }
  }

  return { tracked, dirtySections, hasDirtyChanges, setHasDirtyChanges }
}
