import { useMemo } from 'react'
import { DEFAULTS } from '../constants/defaults'
import { computeBurndown } from '../utils/computeBurndown'
import { getEffectivePayment } from '../utils/ccPayment'

/**
 * Pre-computes burndown results for:
 * - Every saved template (Compare tab)
 * - Every job scenario (Job Scenarios tab)
 * - A selected historical snapshot
 */
export function useScenarioComputations({
  templates,
  jobScenarios,
  whatIf,
  totalSavings,
  unemployment,
  expensesWithSubs,
  expensesForBurndown: _expensesForBurndown,
  oneTimeExpenses,
  oneTimePurchases,
  assetProceeds,
  investments,
  allInvestments: _allInvestments,
  oneTimeIncome,
  monthlyIncome,
  monthlyIncomeForBurndown: _monthlyIncomeForBurndown,
  furloughDate,
  creditCards,
  historicalDate,
  historicalSnapshot,
}) {
  // Pre-compute burndown results for every saved template (for Compare tab)
  const templateResults = useMemo(() => {
    const results = {}
    for (const t of templates) {
      const s = t.snapshot
      if (!s) continue
      const tSavings = (s.savingsAccounts || [])
        .filter(a => a.active !== false)
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
      const tAssetProceeds = (s.assets || [])
        .filter(a => a.includedInWhatIf)
        .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0)
      const tExpenses = [
        ...(s.expenses || []),
        ...(s.subscriptions || [])
          .filter(sub => sub.active !== false)
          .map(sub => ({ id: `sub_${sub.id}`, category: sub.name, monthlyAmount: sub.monthlyAmount, essential: false })),
        ...(s.creditCards || [])
          .filter(c => getEffectivePayment(c) > 0)
          .map(c => ({ id: `cc_${c.id}`, category: `${c.name} (payment)`, monthlyAmount: getEffectivePayment(c), essential: true })),
      ]
      const tWhatIf       = { ...DEFAULTS.whatIf, ...(s.whatIf || {}) }
      const tUnemployment = s.unemployment || DEFAULTS.unemployment
      const tInvestments  = [...(s.investments || []), ...(s.child1Investments || []), ...(s.child2Investments || [])]
      const tOneTime      = s.oneTimeExpenses || []
      const tOneTimeIncome = s.oneTimeIncome || []
      const tMonthlyIncome = s.monthlyIncome || []
      const tFurloughDate = s.furloughDate || DEFAULTS.furloughDate
      const tJobs = s.jobs || []
      const tOneTimePurchases = s.oneTimePurchases || []
      results[t.id] = computeBurndown({
        savings: tSavings,
        unemployment: tUnemployment,
        expenses: tExpenses,
        whatIf: tWhatIf,
        oneTimeExpenses: tOneTime,
        extraCash: tAssetProceeds,
        investments: tInvestments,
        oneTimeIncome: tOneTimeIncome,
        monthlyIncome: tMonthlyIncome,
        startDate: tFurloughDate,
        jobs: tJobs,
        oneTimePurchases: tOneTimePurchases,
        creditCards: s.creditCards || [],
      })
    }
    return results
  }, [templates])

  // Pre-compute burndown results for each job scenario (for Job Scenarios tab)
  const jobScenarioResults = useMemo(() => {
    const baseWhatIfForScenarios = { ...whatIf, jobOfferSalary: 0, jobOfferStartDate: '' }
    const results = {}
    for (const scenario of jobScenarios) {
      const retirementPct = scenario.retirementContributionPct || 0
      const retirementAmount = (scenario.monthlyTakeHome * retirementPct) / 100
      const effectiveTakeHome = scenario.monthlyTakeHome - retirementAmount

      const scenarioWhatIf = {
        ...baseWhatIfForScenarios,
        jobOfferSalary: effectiveTakeHome,
        jobOfferStartDate: scenario.startDate,
        jobOfferAnnualRaisePct: scenario.annualRaisePct || 0,
        jobOfferSigningBonus: scenario.signingBonus || 0,
        jobOfferAnnualBonusPct: scenario.annualBonusPct || 0,
        jobOfferBenefitsOffset: scenario.employerBenefitsMonthly || 0,
        jobOfferEquityAnnual: scenario.equityAnnual || 0,
        jobOfferCommuteMonthly: scenario.commuteMonthly || 0,
        jobOfferGrossAnnual: scenario.grossAnnualSalary || 0,
        jobOfferTaxRatePct: scenario.taxRatePct || 0,
      }
      results[scenario.id] = computeBurndown({
        savings: totalSavings,
        unemployment,
        expenses: expensesWithSubs,
        whatIf: scenarioWhatIf,
        oneTimeExpenses,
        extraCash: assetProceeds,
        investments,
        oneTimeIncome,
        monthlyIncome,
        startDate: furloughDate,
        jobs: [],
        oneTimePurchases,
        creditCards,
      })
    }
    // Baseline (no job) result
    results['__baseline__'] = computeBurndown({
      savings: totalSavings,
      unemployment,
      expenses: expensesWithSubs,
      whatIf: baseWhatIfForScenarios,
      oneTimeExpenses,
      extraCash: assetProceeds,
      investments,
      oneTimeIncome,
      monthlyIncome,
      startDate: furloughDate,
      jobs: [],
      oneTimePurchases,
      creditCards,
    })
    return results
  }, [jobScenarios, totalSavings, unemployment, expensesWithSubs, whatIf, oneTimeExpenses, oneTimePurchases, assetProceeds, investments, oneTimeIncome, monthlyIncome, furloughDate, creditCards])

  // Compute burndown for a historical snapshot so users can compare past projections
  const historicalBurndown = useMemo(() => {
    if (!historicalSnapshot || !historicalDate) return null
    const s = historicalSnapshot
    const hSavings = (s.savingsAccounts || [])
      .filter(a => a.active !== false)
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    const hAssetProceeds = (s.assets || [])
      .filter(a => a.includedInWhatIf)
      .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0)
    const hExpenses = [
      ...(s.expenses || []),
      ...(s.subscriptions || [])
        .filter(sub => sub.active !== false)
        .map(sub => ({ id: `sub_${sub.id}`, category: sub.name, monthlyAmount: sub.monthlyAmount, essential: false })),
      ...(s.creditCards || [])
        .filter(c => getEffectivePayment(c) > 0)
        .map(c => ({ id: `cc_${c.id}`, category: `${c.name} (payment)`, monthlyAmount: getEffectivePayment(c), essential: true })),
    ]
    const hWhatIf       = { ...DEFAULTS.whatIf, ...(s.whatIf || {}) }
    const hUnemployment = s.unemployment || DEFAULTS.unemployment
    const hInvestments  = s.investments  || []
    const hOneTime      = s.oneTimeExpenses || []
    const hOneTimeIncome = s.oneTimeIncome || []
    const hMonthlyIncome = s.monthlyIncome || []
    const hJobs = s.jobs || []
    const hOneTimePurchases = s.oneTimePurchases || []
    return computeBurndown({
      savings: hSavings,
      unemployment: hUnemployment,
      expenses: hExpenses,
      whatIf: hWhatIf,
      oneTimeExpenses: hOneTime,
      extraCash: hAssetProceeds,
      investments: hInvestments,
      oneTimeIncome: hOneTimeIncome,
      monthlyIncome: hMonthlyIncome,
      startDate: historicalDate,
      jobs: hJobs,
      oneTimePurchases: hOneTimePurchases,
      creditCards: s.creditCards || [],
    })
  }, [historicalSnapshot, historicalDate])

  return {
    templateResults,
    jobScenarioResults,
    historicalBurndown,
  }
}
