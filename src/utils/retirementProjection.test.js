import { describe, it, expect } from 'vitest'
import { computeRetirementProjection } from './retirementProjection'

describe('computeRetirementProjection', () => {
  const baseOpts = {
    currentAge: 30,
    targetRetirementAge: 65,
    currentBalance: 100000,
    monthlyContribution: 1000,
    annualReturnPct: 0,
    inflationPct: 0,
    targetNestEgg: 500000,
  }

  it('stops contributions after retirement age', () => {
    const result = computeRetirementProjection(baseOpts)
    const retirementMonth = (65 - 30) * 12

    // At retirement: 100000 + 420 * 1000 = 520000
    const atRetirement = result.dataPoints[retirementMonth]
    expect(atRetirement.nominalBalance).toBe(520000)

    // After retirement with 0% return and no contributions, balance should stay flat
    const oneYearAfter = result.dataPoints[retirementMonth + 12]
    expect(oneYearAfter.nominalBalance).toBe(520000)
  })

  it('still grows with returns after retirement but without contributions', () => {
    const result = computeRetirementProjection({
      ...baseOpts,
      annualReturnPct: 12,
      monthlyContribution: 0,
    })
    const retirementMonth = (65 - 30) * 12
    const atRetirement = result.dataPoints[retirementMonth].nominalBalance
    const afterRetirement = result.dataPoints[retirementMonth + 1].nominalBalance

    expect(afterRetirement).toBeGreaterThan(atRetirement)
  })
})
