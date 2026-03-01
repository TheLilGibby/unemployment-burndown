import { useMemo } from 'react'
import dayjs from 'dayjs'

/**
 * whatIf shape:
 *   expenseReductionPct    number  0-100  % cut to non-essential expenses
 *   sideIncomeMonthly      number  flat monthly side income
 *   emergencyFloor         number  stop runway at this cash floor (default 0)
 *   benefitDelayWeeks      number  shift benefit start by +N weeks
 *   benefitCutWeeks        number  reduce benefit duration by N weeks
 *   expenseRaisePct         number  0-50   % raise applied to ALL expenses (inflation/lifestyle)
 *   freezeDate             string  ISO date – full spending until here, then reductions kick in
 *   jobOfferSalary         number  monthly take-home after job starts
 *   jobOfferStartDate      string  ISO date job begins
 *   jobOfferAnnualRaisePct number  annual salary raise % (compounded yearly)
 *   freelanceRamp          array   [{monthOffset, monthlyAmount}] sorted by monthOffset
 *   partnerIncomeMonthly   number  second household income
 *   partnerStartDate       string  ISO date partner income begins
 *   jobOfferSigningBonus   number  one-time signing bonus (net) at job start
 *   jobOfferAnnualBonusPct number  0-100 annual bonus as % of gross salary
 *   jobOfferBenefitsOffset number  monthly expense reduction from employer benefits
 *   jobOfferEquityAnnual   number  annual equity/RSU vesting (net), distributed monthly
 *   jobOfferCommuteMonthly number  monthly commute cost added to expenses
 *   jobOfferGrossAnnual    number  gross annual salary (for bonus calculation)
 *   jobOfferTaxRatePct     number  effective tax rate (for bonus calculation)
 *   jobOfferEmployerMatchPct number 0-100 employer 401k match % (tracked separately, not liquid)
 */
export function useBurndown(savings, unemployment, expenses, whatIf, oneTimeExpenses = [], extraCash = 0, investments = [], oneTimeIncome = [], monthlyIncome = [], startDate = null, jobs = []) {
  return useMemo(() => {
    const today = dayjs(startDate || new Date())

    // --- Benefit window ---
    const rawBenefitStart = dayjs(unemployment.startDate)
    const delayWeeks = Number(whatIf.benefitDelayWeeks) || 0
    const cutWeeks   = Number(whatIf.benefitCutWeeks)   || 0
    const benefitStart = rawBenefitStart.add(delayWeeks, 'week')
    const baseDuration = Math.max(0, unemployment.durationWeeks - cutWeeks)
    const benefitEnd   = benefitStart.add(baseDuration, 'week')
    const monthlyBenefits = unemployment.weeklyAmount * (52 / 12)

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
    // endDate is the primary cutoff: if set, salary stops after endDate regardless of status.
    // If no endDate, fall back to status check (only 'active' jobs count).
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

    // --- Simulation ---
    const MAX_MONTHS = 120
    let balance = (Number(savings) || 0) + (Number(extraCash) || 0)
    let balanceEssential = balance  // parallel track: essentials + income only

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
      },
    ]

    let runoutDate  = null
    let runoutMonth = null

    for (let i = 1; i <= MAX_MONTHS; i++) {
      const currentDate = today.add(i, 'month')

      // Benefits
      const inBenefitWindow =
        currentDate.isAfter(benefitStart) && currentDate.isBefore(benefitEnd)
      let income = inBenefitWindow ? monthlyBenefits : 0

      // Job income from jobs array
      const jobIncomeThisMonth = jobIncomeForDate(currentDate)
      income += jobIncomeThisMonth

      // Job offer salary (what-if scenario, with annual raise compounding)
      const jobOfferActive = jobStartDate && !currentDate.isBefore(jobStartDate)
      if (jobOfferActive) {
        const monthsSinceStart = currentDate.diff(jobStartDate, 'month')
        const fullYears = Math.floor(monthsSinceStart / 12)
        const raiseFactor = (jobAnnualRaisePct > 0 && fullYears > 0)
          ? Math.pow(1 + jobAnnualRaisePct / 100, fullYears) : 1
        income += jobSalary * raiseFactor

        // Signing bonus: one-time income in the first month
        if (jobOfferSigningBonus > 0 && monthsSinceStart === 0) {
          income += jobOfferSigningBonus
        }

        // Annual bonus: paid at each yearly anniversary
        if (jobOfferAnnualBonusPct > 0 && monthsSinceStart > 0 && monthsSinceStart % 12 === 0) {
          const currentGross = jobOfferGrossAnnual * raiseFactor
          const bonusNet = currentGross * (jobOfferAnnualBonusPct / 100) * (1 - jobOfferTaxRatePct / 100)
          income += bonusNet
        }

        // Equity/RSU vesting: distributed monthly as liquid income
        if (jobOfferEquityAnnual > 0) {
          income += jobOfferEquityAnnual / 12
        }
      }

      // Flat side income (applies when no job income from either source)
      if (jobIncomeThisMonth === 0 && !jobOfferActive) income += sideIncome

      // Partner income
      const partnerActive = partnerStartDate && !currentDate.isBefore(partnerStartDate)
      if (partnerActive) income += partnerIncome

      // Recurring monthly income sources
      for (const src of monthlyIncome) {
        if (!src.monthlyAmount) continue
        if (src.startDate && dayjs(src.startDate).isAfter(currentDate)) continue
        if (src.endDate && dayjs(src.endDate).isBefore(currentDate)) continue
        income += Number(src.monthlyAmount) || 0
      }

      // Freelance ramp: find highest tier whose monthOffset <= i
      if (freelanceRamp.length > 0) {
        const activeTier = [...freelanceRamp]
          .filter(t => t.monthOffset <= i)
          .sort((a, b) => b.monthOffset - a.monthOffset)[0]
        if (activeTier) income += Number(activeTier.monthlyAmount) || 0
      }

      // Expense reduction only applies after freeze date (or always if no freeze date)
      const afterFreeze = freezeDate ? !currentDate.isBefore(freezeDate) : true
      const expReductionFactor = afterFreeze ? reductionFactor : 1
      let monthExpenses = (essentialTotal + nonEssentialTotal * expReductionFactor) * raiseFactor

      // Compensation package adjustments to expenses (only when job is active)
      if (jobOfferActive) {
        // Employer benefits offset personal insurance costs
        if (jobOfferBenefitsOffset > 0) monthExpenses = Math.max(0, monthExpenses - jobOfferBenefitsOffset)
        // Commute cost adds to monthly expenses
        if (jobOfferCommuteMonthly > 0) monthExpenses += jobOfferCommuteMonthly
      }

      const oneTimeCost = oneTimeByMonth[i] || 0
      const oneTimeIncomeThisMonth = oneTimeIncomeByMonth[i] || 0
      const netBurn = monthExpenses + monthlyInvestments - income + oneTimeCost - oneTimeIncomeThisMonth
      const prevBalance = balance
      balance = balance - netBurn

      // Essentials-only parallel track (no discretionary spending, no one-time costs)
      const netBurnEssentialOnly = essentialTotal * raiseFactor + monthlyInvestments - income
      const prevBalanceEssential = balanceEssential
      balanceEssential = balanceEssential - netBurnEssentialOnly

      // Runout = when balance drops to or below the emergency floor
      const effectiveBalance = balance - emergencyFloor
      const prevEffective   = prevBalance - emergencyFloor

      if (effectiveBalance <= 0 && runoutDate === null) {
        const safeDenom = netBurn === 0 ? 1 : netBurn
        const fraction  = Math.min(1, Math.max(0, prevEffective / safeDenom))
        const crossoverDate = today.add(i - 1 + fraction, 'month')
        runoutDate  = crossoverDate.toDate()
        runoutMonth = i - 1 + fraction
      }

      const effectiveBalanceEssential = balanceEssential - emergencyFloor

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
      })

      if (effectiveBalance <= 0 && i >= (runoutMonth || 0) + 3) break
    }

    // Current-month net burn (no one-time)
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
      // Equity vesting income
      if (jobOfferEquityAnnual > 0) currentIncome += jobOfferEquityAnnual / 12
    }
    if (currentJobIncome === 0 && !jobOfferActiveNow) {
      currentIncome += sideIncome
    }
    if (partnerActiveNow) currentIncome += partnerIncome
    // Adjust effective expenses for current-month net burn
    let currentEffectiveExpenses = effectiveExpenses
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
    }
  }, [savings, unemployment, expenses, whatIf, oneTimeExpenses, extraCash, investments, oneTimeIncome, monthlyIncome, startDate, jobs])
}
