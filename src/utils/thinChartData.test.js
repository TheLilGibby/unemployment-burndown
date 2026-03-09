import { describe, it, expect } from 'vitest'
import { thinChartData, isBurndownCritical } from './thinChartData'

describe('thinChartData', () => {
  it('returns data unchanged when under maxPoints', () => {
    const data = [{ v: 1 }, { v: 2 }, { v: 3 }]
    expect(thinChartData(data, 10)).toBe(data)
  })

  it('thins data to roughly maxPoints', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ month: i }))
    const result = thinChartData(data, 10)
    expect(result.length).toBeLessThanOrEqual(15)
    expect(result.length).toBeGreaterThanOrEqual(10)
  })

  it('always preserves last point', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ month: i }))
    const result = thinChartData(data, 10)
    expect(result[result.length - 1]).toBe(data[99])
  })

  it('preserves critical points via predicate', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({
      month: i,
      special: i === 47,
    }))
    const result = thinChartData(data, 10, (pt) => pt.special)
    expect(result.some(pt => pt.month === 47)).toBe(true)
  })
})

describe('isBurndownCritical', () => {
  it('marks zero-balance points as critical', () => {
    const arr = [{ balance: 1000 }, { balance: 0 }]
    expect(isBurndownCritical(arr[1], 1, arr)).toBe(true)
  })

  it('marks one-time cost points as critical', () => {
    const pt = { oneTimeCost: 500 }
    expect(isBurndownCritical(pt, 0, [pt])).toBe(true)
  })

  it('marks one-time income points as critical', () => {
    const pt = { oneTimeIncome: 1000 }
    expect(isBurndownCritical(pt, 0, [pt])).toBe(true)
  })

  it('marks benefit window transitions as critical', () => {
    const arr = [
      { inBenefitWindow: true },
      { inBenefitWindow: false },
    ]
    expect(isBurndownCritical(arr[1], 1, arr)).toBe(true)
  })

  it('does not mark normal points as critical', () => {
    const arr = [
      { balance: 1000, inBenefitWindow: true },
      { balance: 900, inBenefitWindow: true },
    ]
    expect(isBurndownCritical(arr[1], 1, arr)).toBe(false)
  })
})
