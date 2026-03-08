import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatMonths, formatDays } from './formatters'

describe('formatCurrency', () => {
  it('formats positive numbers with dollar sign and commas', () => {
    expect(formatCurrency(1000)).toBe('$1,000')
    expect(formatCurrency(1234567)).toBe('$1,234,567')
    expect(formatCurrency(50)).toBe('$50')
  })

  it('preserves decimal precision up to 2 places', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
    expect(formatCurrency(999.49)).toBe('$999.49')
    expect(formatCurrency(100.10)).toBe('$100.1')
    expect(formatCurrency(50.999)).toBe('$51')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('handles null and undefined', () => {
    expect(formatCurrency(null)).toBe('$0')
    expect(formatCurrency(undefined)).toBe('$0')
  })

  it('handles NaN', () => {
    expect(formatCurrency(NaN)).toBe('$0')
  })

  it('handles negative numbers', () => {
    expect(formatCurrency(-500)).toBe('-$500')
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56')
  })
})

describe('formatDate', () => {
  it('formats Date objects', () => {
    const date = new Date(2026, 2, 15) // months are 0-indexed
    expect(formatDate(date)).toBe('March 15, 2026')
  })

  it('formats date strings', () => {
    expect(formatDate('2026-12-25T00:00:00')).toBe('December 25, 2026')
  })

  it('handles null and undefined', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  it('handles empty string', () => {
    expect(formatDate('')).toBe('—')
  })
})

describe('formatMonths', () => {
  it('formats months only', () => {
    expect(formatMonths(1)).toBe('1 month')
    expect(formatMonths(6)).toBe('6 months')
    expect(formatMonths(11)).toBe('11 months')
  })

  it('formats years only when evenly divisible', () => {
    expect(formatMonths(12)).toBe('1 year')
    expect(formatMonths(24)).toBe('2 years')
    expect(formatMonths(36)).toBe('3 years')
  })

  it('formats years and months combined', () => {
    expect(formatMonths(14)).toBe('1 yr 2 mo')
    expect(formatMonths(25)).toBe('2 yr 1 mo')
    expect(formatMonths(30)).toBe('2 yr 6 mo')
  })

  it('handles zero and negative', () => {
    expect(formatMonths(0)).toBe('0 months')
    expect(formatMonths(-5)).toBe('0 months')
  })

  it('handles null and undefined', () => {
    expect(formatMonths(null)).toBe('0 months')
    expect(formatMonths(undefined)).toBe('0 months')
  })
})

describe('formatDays', () => {
  it('formats days under 30', () => {
    expect(formatDays(1)).toBe('1 day')
    expect(formatDays(15)).toBe('15 days')
    expect(formatDays(29)).toBe('29 days')
  })

  it('converts to months for 30+ days', () => {
    expect(formatDays(30)).toBe('~1 month')
    expect(formatDays(60)).toBe('~2 months')
    expect(formatDays(90)).toBe('~3 months')
  })

  it('handles zero and negative', () => {
    expect(formatDays(0)).toBe('0 days')
    expect(formatDays(-10)).toBe('0 days')
  })

  it('handles null and undefined', () => {
    expect(formatDays(null)).toBe('0 days')
    expect(formatDays(undefined)).toBe('0 days')
  })
})
