import { MAX_PROJECTION_AGE } from '../constants/financial'

/**
 * Compute a month-by-month retirement projection.
 *
 * @param {object} opts
 * @param {number} opts.currentAge
 * @param {number} opts.targetRetirementAge
 * @param {number} opts.currentBalance
 * @param {number} opts.monthlyContribution
 * @param {number} opts.annualReturnPct
 * @param {number} opts.inflationPct
 * @param {number} opts.targetNestEgg
 * @returns {{ dataPoints, projectedAtRetirement, hitsGoal, surplus, shortfall, monthlyToReachGoal }}
 */
export function computeRetirementProjection({
  currentAge,
  targetRetirementAge,
  currentBalance,
  monthlyContribution,
  annualReturnPct,
  inflationPct,
  targetNestEgg,
}) {
  const monthlyReturn = (annualReturnPct / 100) / 12
  const monthlyInflation = (inflationPct / 100) / 12
  const totalMonths = Math.max(0, Math.ceil((MAX_PROJECTION_AGE - currentAge) * 12)) // project to max age
  const retirementMonth = Math.max(0, (targetRetirementAge - currentAge) * 12)

  const now = new Date()
  const dataPoints = []

  let nominalBalance = currentBalance

  for (let m = 0; m <= totalMonths; m++) {
    const age = currentAge + m / 12
    const date = new Date(now.getFullYear(), now.getMonth() + m)
    const dateLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    const inflationFactor = Math.pow(1 + monthlyInflation, m)
    const realBalance = nominalBalance / inflationFactor

    dataPoints.push({ month: m, dateLabel, age, nominalBalance, realBalance: Math.round(realBalance) })

    // Grow balance; stop contributions after retirement
    const contrib = m < retirementMonth ? monthlyContribution : 0
    nominalBalance = nominalBalance * (1 + monthlyReturn) + contrib
  }

  // Value at retirement (inflation-adjusted)
  const retirementIdx = Math.min(retirementMonth, dataPoints.length - 1)
  const projectedAtRetirement = dataPoints[retirementIdx]?.realBalance ?? 0

  const hitsGoal = projectedAtRetirement >= targetNestEgg
  const surplus = Math.max(0, projectedAtRetirement - targetNestEgg)
  const shortfall = Math.max(0, targetNestEgg - projectedAtRetirement)

  // Calculate monthly contribution needed to reach the goal
  let monthlyToReachGoal = 0
  if (retirementMonth > 0) {
    const inflationFactor = Math.pow(1 + monthlyInflation, retirementMonth)
    const nominalTarget = targetNestEgg * inflationFactor
    // Future value of current balance
    const fvBalance = currentBalance * Math.pow(1 + monthlyReturn, retirementMonth)
    const gap = nominalTarget - fvBalance

    if (gap > 0 && monthlyReturn > 0) {
      // FV of annuity formula: FV = P * ((1+r)^n - 1) / r
      const annuityFactor = (Math.pow(1 + monthlyReturn, retirementMonth) - 1) / monthlyReturn
      monthlyToReachGoal = Math.max(0, Math.ceil(gap / annuityFactor))
    } else if (gap > 0 && monthlyReturn === 0) {
      monthlyToReachGoal = Math.ceil(gap / retirementMonth)
    }
  }

  return {
    dataPoints,
    projectedAtRetirement,
    hitsGoal,
    surplus,
    shortfall,
    monthlyToReachGoal,
  }
}
