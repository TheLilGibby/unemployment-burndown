import dayjs from 'dayjs'
import { getEffectivePayment } from './ccPayment.js'
import { WEEKS_PER_MONTH } from '../constants/financial'

/**
 * Pure burndown simulation — computes a month-by-month cash runway projection.
 * Extracted from useBurndown hook for use in Node.js tooling (MCP server, scripts).
 *
 * @param {object} params
 * @param {number}  params.savings           Current total savings
 * @param {object}  params.unemployment      { startDate, weeklyAmount, durationWeeks }
 * @param {Array}   params.expenses          Monthly expense items
 * @param {object}  params.whatIf            What-if scenario toggles
 * @param {Array}   params.oneTimeExpenses   One-time future expenses
 * @param {number}  params.extraCash         Extra cash on hand
 * @param {Array}   params.investments       Monthly investment contributions
 * @param {Array}   params.oneTimeIncome     One-time income events
 * @param {Array}   params.monthlyIncome     Recurring income sources
 * @param {string|null} params.startDate     Simulation start (ISO string or null for today)
 * @param {Array}   params.jobs              Active/ended job records
 * @param {Array}   params.oneTimePurchases  One-time purchases (treated as expenses)
 * @param {Array}   params.creditCards       Credit card records
 * @param {object|null} params.severance    Severance package details (DEFAULTS.severance shape)
 */
export function computeBurndown({
  savings = 0,
  unemployment = {},
  expenses = [],
  whatIf = {},
  oneTimeExpenses = [],
  extraCash = 0,
  investments = [],
  oneTimeIncome = [],
  monthlyIncome = [],
  startDate = null,
  jobs = [],
  oneTimePurchases = [],
  creditCards = [],
  healthInsurance = [],
  severance = null,
} = {}) {
  const today = dayjs(startDate || new Date())

  // --- Severance calculations ---
  const sev = severance && severance.enabled ? severance : null
  let severanceNetAmount = 0
  let severanceMonthlyNet = 0
  let severanceStart = null
  let severanceEnd = null
  let ptoPayout = 0
  if (sev) {
    const grossAmount = Number(sev.grossAmount) || 0
    const federalTax = (Number(sev.taxWithholdingPct) || 0) / 100
    const stateTax = (Number(sev.stateTaxPct) || 0) / 100
    const totalTaxRate = Math.min(federalTax + stateTax, 1)
    severanceNetAmount = grossAmount * (1 - totalTaxRate)
    ptoPayout = Number(sev.ptoPayout) || 0
    severanceStart = sev.startDate ? dayjs(sev.startDate) : null
    if (sev.paymentStructure === 'salary_continuation') {
      const months = Math.max(1, Number(sev.continuationMonths) || 1)
      severanceMonthlyNet = severanceNetAmount / months
      severanceEnd = sev.endDate ? dayjs(sev.endDate) : (severanceStart ? severanceStart.add(months, 'month') : null)
    } else {
      // lump sum: treat end as start (one-time payment)
      severanceEnd = severanceStart
    }
  }

  // --- Benefit window ---
  const rawBenefitStart = dayjs(unemployment.startDate)
  const delayWeeks = Number(whatIf.benefitDelayWeeks) || 0
  const cutWeeks   = Number(whatIf.benefitCutWeeks)   || 0
  // If severance delays unemployment, push benefit start to after severance end
  const sevDelayedBenefitStart = (sev && sev.delaysUnemployment && severanceEnd)
    ? (rawBenefitStart.isBefore(severanceEnd) ? severanceEnd : rawBenefitStart)
    : rawBenefitStart
  const benefitStart = sevDelayedBenefitStart.add(delayWeeks, 'week')
  const baseDuration = Math.max(0, unemployment.durationWeeks - cutWeeks)
  const benefitEnd   = benefitStart.add(baseDuration, 'week')
  const monthlyBenefits = unemployment.weeklyAmount * WEEKS_PER_MONTH

  // --- Expense split ---
  const essentialTotal = expenses
    .filter(e => e.essential)
    .reduce((sum, e) => sum + (Number(e.monthlyAmount) || 0), 0)
  const nonEssentialTotal = expenses
    .filter(e => !e.essential)
    .reduce((sum, e) => sum + (Number(e.monthlyAmount) || 0), 0)

  const reductionFactor = 1 - (whatIf.expenseReductionPct || 0) / 100
  const raiseFactor = 1 + (whatIf.expenseRaisePct || 0) / 100
  const effectiveExpenses = (essentialTotal + nonEssentialTotal * reductionFactor) * raiseFactor

  // --- Flat side income ---
  const sideIncome = Number(whatIf.sideIncomeMonthly) || 0

  // --- Monthly investments ---
  const monthlyInvestments = investments
    .filter(inv => inv.active)
    .reduce((sum, inv) => sum + (Number(inv.monthlyAmount) || 0), 0)

  // --- One-time expenses by month slot ---
  const oneTimeByMonth = {}
  for (const ote of oneTimeExpenses) {
    if (!ote.date || !ote.amount) continue
    const oteDate = dayjs(ote.date)
    if (oteDate.isBefore(today)) continue
    const monthsAhead = oteDate.diff(today, 'month')
    const slot = Math.max(1, monthsAhead + 1)
    oneTimeByMonth[slot] = (oneTimeByMonth[slot] || 0) + (Number(ote.amount) || 0)
  }
  for (const otp of oneTimePurchases) {
    if (!otp.date || !otp.amount) continue
    const otpDate = dayjs(otp.date)
    if (otpDate.isBefore(today)) continue
    const monthsAhead = otpDate.diff(today, 'month')
    const slot = Math.max(1, monthsAhead + 1)
    oneTimeByMonth[slot] = (oneTimeByMonth[slot] || 0) + (Number(otp.amount) || 0)
  }

  // --- One-time income injections by month slot ---
  const oneTimeIncomeByMonth = {}
  for (const oti of oneTimeIncome) {
    if (!oti.date || !oti.amount) continue
    const otiDate = dayjs(oti.date)
    if (otiDate.isBefore(today)) continue
    const monthsAhead = otiDate.diff(today, 'month')
    const slot = Math.max(1, monthsAhead + 1)
    oneTimeIncomeByMonth[slot] = (oneTimeIncomeByMonth[slot] || 0) + (Number(oti.amount) || 0)
  }

  // --- Job offer (what-if scenario) ---
  const jobSalary    = Number(whatIf.jobOfferSalary) || 0
  const jobStartDate = whatIf.jobOfferStartDate ? dayjs(whatIf.jobOfferStartDate) : null
  const jobAnnualRaisePct = Number(whatIf.jobOfferAnnualRaisePct) || 0

  // --- Compensation package fields ---
  const jobOfferSigningBonus   = Number(whatIf.jobOfferSigningBonus) || 0
  const jobOfferAnnualBonusPct = Number(whatIf.jobOfferAnnualBonusPct) || 0
  const jobOfferBenefitsOffset = Number(whatIf.jobOfferBenefitsOffset) || 0
  const jobOfferEquityAnnual   = Number(whatIf.jobOfferEquityAnnual) || 0
  const jobOfferCommuteMonthly = Number(whatIf.jobOfferCommuteMonthly) || 0
  const jobOfferGrossAnnual    = Number(whatIf.jobOfferGrossAnnual) || 0
  const jobOfferTaxRatePct     = Number(whatIf.jobOfferTaxRatePct) || 0

  // --- Freeze date ---
  const freezeDate = whatIf.freezeDate ? dayjs(whatIf.freezeDate) : null

  // --- Freelance ramp ---
  const freelanceRamp = Array.isArray(whatIf.freelanceRamp) ? whatIf.freelanceRamp : []

  // --- Partner income ---
  const partnerIncome    = Number(whatIf.partnerIncomeMonthly) || 0
  const partnerStartDate = whatIf.partnerStartDate ? dayjs(whatIf.partnerStartDate) : null

  // --- Emergency floor ---
  const emergencyFloor = Number(whatIf.emergencyFloor) || 0

  // --- Helper: compute job income for a given date ---
  function jobIncomeForDate(d) {
    let total = 0
    for (const job of jobs) {
      if (!job.monthlySalary) continue
      if (job.startDate && dayjs(job.startDate).isAfter(d)) continue
      if (job.endDate) {
        if (dayjs(job.endDate).isBefore(d)) continue
      } else {
        if (job.status !== 'active') continue
      }
      total += Number(job.monthlySalary) || 0
    }
    return total
  }

  // --- Credit card balance trajectories ---
  const ccBalances = creditCards.map(c => ({
    id: c.id,
    balance: Number(c.balance) || 0,
    apr: Number(c.apr) || 0,
    payment: getEffectivePayment(c),
    strategy: c.paymentStrategy || 'minimum',
  }))
  const initialDebt = ccBalances.reduce((s, cc) => s + cc.balance, 0)

  // --- Simulation ---
  const MAX_MONTHS = 120
  let balance = (Number(savings) || 0) + (Number(extraCash) || 0)
  let balanceEssential = balance

  const dataPoints = [
    {
      date: today.toDate(),
      dateLabel: today.format('MMM YYYY'),
      balance: Math.round(Math.max(0, balance - emergencyFloor)),
      rawBalance: Math.round(balance),
      balanceEssentialOnly: Math.round(Math.max(0, balanceEssential - emergencyFloor)),
      month: 0,
      income: 0,
      netBurn: 0,
      netBurnEssentialOnly: 0,
      inBenefitWindow: false,
      jobActive: false,
      totalDebt: Math.round(initialDebt),
      netPosition: Math.round(Math.max(0, balance - emergencyFloor) - initialDebt),
    },
  ]

  let runoutDate  = null
  let runoutMonth = null

  for (let i = 1; i <= MAX_MONTHS; i++) {
    const currentDate = today.add(i, 'month')

    const inBenefitWindow =
      currentDate.isAfter(benefitStart) && currentDate.isBefore(benefitEnd)
    let income = inBenefitWindow ? monthlyBenefits : 0

    // Severance income
    if (sev && severanceStart) {
      const prevDate = today.add(i - 1, 'month')
      if (sev.paymentStructure === 'lump_sum') {
        // Lump sum: inject on the month that contains the start date
        if (!severanceStart.isBefore(prevDate) && severanceStart.isBefore(currentDate)) {
          income += severanceNetAmount + ptoPayout
        }
      } else {
        // Salary continuation: spread evenly across the severance period
        const inSeveranceWindow = currentDate.isAfter(severanceStart) && (severanceEnd ? !currentDate.isAfter(severanceEnd) : true)
        if (inSeveranceWindow) {
          income += severanceMonthlyNet
        }
        // PTO payout on start date (one-time, same month as first continuation payment)
        if (ptoPayout > 0 && !severanceStart.isBefore(prevDate) && severanceStart.isBefore(currentDate)) {
          income += ptoPayout
        }
      }
    }

    const jobIncomeThisMonth = jobIncomeForDate(currentDate)
    income += jobIncomeThisMonth

    const jobOfferActive = jobStartDate && !currentDate.isBefore(jobStartDate)
    if (jobOfferActive) {
      const monthsSinceStart = currentDate.diff(jobStartDate, 'month')
      const fullYears = Math.floor(monthsSinceStart / 12)
      const raiseF = (jobAnnualRaisePct > 0 && fullYears > 0)
        ? Math.pow(1 + jobAnnualRaisePct / 100, fullYears) : 1
      income += jobSalary * raiseF

      if (jobOfferSigningBonus > 0 && monthsSinceStart === 0) {
        income += jobOfferSigningBonus
      }

      if (jobOfferAnnualBonusPct > 0 && monthsSinceStart > 0 && monthsSinceStart % 12 === 0) {
        const currentGross = jobOfferGrossAnnual * raiseF
        const bonusNet = currentGross * (jobOfferAnnualBonusPct / 100) * (1 - jobOfferTaxRatePct / 100)
        income += bonusNet
      }

      if (jobOfferEquityAnnual > 0) {
        income += jobOfferEquityAnnual / 12
      }
    }

    if (jobIncomeThisMonth === 0 && !jobOfferActive) income += sideIncome

    const partnerActive = partnerStartDate && !currentDate.isBefore(partnerStartDate)
    if (partnerActive) income += partnerIncome

    for (const src of monthlyIncome) {
      if (!src.monthlyAmount) continue
      if (src.startDate && dayjs(src.startDate).isAfter(currentDate)) continue
      if (src.endDate && dayjs(src.endDate).isBefore(currentDate)) continue
      income += Number(src.monthlyAmount) || 0
    }

    if (freelanceRamp.length > 0) {
      const activeTier = [...freelanceRamp]
        .filter(t => t.monthOffset <= i)
        .sort((a, b) => b.monthOffset - a.monthOffset)[0]
      if (activeTier) income += Number(activeTier.monthlyAmount) || 0
    }

    const afterFreeze = freezeDate ? !currentDate.isBefore(freezeDate) : true
    const expReductionFactor = afterFreeze ? reductionFactor : 1
    let monthExpenses = (essentialTotal + nonEssentialTotal * expReductionFactor) * raiseFactor

    for (const hi of healthInsurance) {
      if (!hi.monthlyPremium) continue
      if (hi.startDate && dayjs(hi.startDate).isAfter(currentDate)) continue
      if (hi.endDate && dayjs(hi.endDate).isBefore(currentDate)) continue
      monthExpenses += Number(hi.monthlyPremium) || 0
    }

    if (jobOfferActive) {
      if (jobOfferBenefitsOffset > 0) monthExpenses = Math.max(0, monthExpenses - jobOfferBenefitsOffset)
      if (jobOfferCommuteMonthly > 0) monthExpenses += jobOfferCommuteMonthly
    }

    const oneTimeCost = oneTimeByMonth[i] || 0
    const oneTimeIncomeThisMonth = oneTimeIncomeByMonth[i] || 0
    const netBurn = monthExpenses + monthlyInvestments - income + oneTimeCost - oneTimeIncomeThisMonth
    const prevBalance = balance
    balance = balance - netBurn

    const netBurnEssentialOnly = essentialTotal * raiseFactor + monthlyInvestments - income
    balanceEssential = balanceEssential - netBurnEssentialOnly

    const effectiveBalance = balance - emergencyFloor
    const prevEffective   = prevBalance - emergencyFloor

    if (effectiveBalance <= 0 && runoutDate === null) {
      const fraction = netBurn > 0
        ? Math.min(1, Math.max(0, prevEffective / netBurn))
        : 0
      const crossoverDate = today.add(i - 1 + fraction, 'month')
      runoutDate  = crossoverDate.toDate()
      runoutMonth = i - 1 + fraction
    }

    const effectiveBalanceEssential = balanceEssential - emergencyFloor

    for (const cc of ccBalances) {
      if (cc.balance <= 0) continue
      if (cc.strategy === 'full') {
        cc.balance = 0
      } else {
        const interest = cc.balance * (cc.apr / 100 / 12)
        cc.balance = Math.max(0, cc.balance + interest - cc.payment)
      }
    }
    const totalDebt = ccBalances.reduce((s, cc) => s + cc.balance, 0)

    dataPoints.push({
      date: currentDate.toDate(),
      dateLabel: currentDate.format('MMM YYYY'),
      balance: Math.max(0, Math.round(effectiveBalance)),
      rawBalance: Math.round(balance),
      balanceEssentialOnly: Math.max(0, Math.round(effectiveBalanceEssential)),
      month: i,
      income: Math.round(income),
      netBurn: Math.round(netBurn),
      netBurnEssentialOnly: Math.round(netBurnEssentialOnly),
      oneTimeCost: oneTimeCost > 0 ? Math.round(oneTimeCost) : undefined,
      oneTimeIncome: oneTimeIncomeThisMonth > 0 ? Math.round(oneTimeIncomeThisMonth) : undefined,
      inBenefitWindow,
      jobActive: jobIncomeThisMonth > 0,
      totalDebt: Math.round(totalDebt),
      netPosition: Math.round(Math.max(0, effectiveBalance) - totalDebt),
    })

    if (effectiveBalance <= 0 && i >= (runoutMonth || 0) + 3) break
  }

  // Current-month net burn
  const currentInBenefit = today.isAfter(benefitStart) && today.isBefore(benefitEnd)
  const activeMonthlyIncomeNow = monthlyIncome
    .filter(src => {
      if (!src.monthlyAmount) return false
      if (src.startDate && dayjs(src.startDate).isAfter(today)) return false
      if (src.endDate && dayjs(src.endDate).isBefore(today)) return false
      return true
    })
    .reduce((s, src) => s + (Number(src.monthlyAmount) || 0), 0)
  const currentJobIncome = jobIncomeForDate(today)
  const partnerActiveNow = partnerStartDate && !today.isBefore(partnerStartDate)
  let currentIncome = (currentInBenefit ? monthlyBenefits : 0) + activeMonthlyIncomeNow
  if (currentJobIncome > 0) {
    currentIncome += currentJobIncome
  }
  const jobOfferActiveNow = jobStartDate && !today.isBefore(jobStartDate)
  if (jobOfferActiveNow) {
    if (jobAnnualRaisePct > 0 && jobStartDate) {
      const monthsNow = today.diff(jobStartDate, 'month')
      const yearsNow = Math.floor(Math.max(0, monthsNow) / 12)
      currentIncome += yearsNow > 0
        ? jobSalary * Math.pow(1 + jobAnnualRaisePct / 100, yearsNow)
        : jobSalary
    } else {
      currentIncome += jobSalary
    }
    if (jobOfferEquityAnnual > 0) currentIncome += jobOfferEquityAnnual / 12
  }
  if (currentJobIncome === 0 && !jobOfferActiveNow) {
    currentIncome += sideIncome
  }
  if (partnerActiveNow) currentIncome += partnerIncome
  let currentEffectiveExpenses = effectiveExpenses
  let totalHealthInsurance = 0
  for (const hi of healthInsurance) {
    if (!hi.monthlyPremium) continue
    if (hi.startDate && dayjs(hi.startDate).isAfter(today)) continue
    if (hi.endDate && dayjs(hi.endDate).isBefore(today)) continue
    const amt = Number(hi.monthlyPremium) || 0
    currentEffectiveExpenses += amt
    totalHealthInsurance += amt
  }
  if (jobOfferActiveNow) {
    if (jobOfferBenefitsOffset > 0) currentEffectiveExpenses = Math.max(0, currentEffectiveExpenses - jobOfferBenefitsOffset)
    if (jobOfferCommuteMonthly > 0) currentEffectiveExpenses += jobOfferCommuteMonthly
  }
  const currentNetBurn = currentEffectiveExpenses + monthlyInvestments - currentIncome
  const totalMonthlyIncome = activeMonthlyIncomeNow
  const totalJobIncome = currentJobIncome

  return {
    dataPoints,
    runoutDate,
    totalRunwayMonths: runoutMonth,
    currentNetBurn,
    effectiveExpenses,
    monthlyBenefits,
    monthlyInvestments,
    totalMonthlyIncome,
    totalJobIncome,
    benefitEnd: benefitEnd.toDate(),
    benefitStart: benefitStart.toDate(),
    emergencyFloor,
    totalHealthInsurance,
  }
}
