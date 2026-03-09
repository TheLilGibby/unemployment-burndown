import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  exportBurndownCSV,
  exportExpensesCSV,
  exportSavingsCSV,
  exportScenariosCSV,
  exportBurndownPDF,
} from './export'

global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

const mockLink = { href: '', download: '', click: vi.fn() }
const originalCreateElement = document.createElement.bind(document)
document.createElement = vi.fn((tag) => {
  if (tag === 'a') return mockLink
  return originalCreateElement(tag)
})
document.body.appendChild = vi.fn()
document.body.removeChild = vi.fn()

beforeEach(() => { vi.clearAllMocks() })

describe('exportBurndownCSV', () => {
  it('exports burndown dataPoints as CSV', () => {
    exportBurndownCSV({
      dataPoints: [{ date: '2026-01-01', dateLabel: 'Jan 2026', balance: 10000, income: 2000, netBurn: 1000, totalDebt: 500, netPosition: 9500, inBenefitWindow: true, jobActive: false }],
    })
    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toContain('.csv')
  })
  it('throws when no data', () => {
    expect(() => exportBurndownCSV(null)).toThrow('No burndown data to export')
    expect(() => exportBurndownCSV({ dataPoints: [] })).toThrow('No burndown data to export')
  })
})

describe('exportExpensesCSV', () => {
  it('exports', () => {
    exportExpensesCSV([{ name: 'Rent', monthlyAmount: 1500, essential: true, category: 'Housing' }])
    expect(mockLink.click).toHaveBeenCalled()
  })
  it('throws when empty', () => { expect(() => exportExpensesCSV([])).toThrow() })
})

describe('exportSavingsCSV', () => {
  it('exports', () => {
    exportSavingsCSV([{ name: 'Checking', amount: 5000, type: 'Checking', institution: 'Bank A' }])
    expect(mockLink.click).toHaveBeenCalled()
  })
  it('throws when empty', () => { expect(() => exportSavingsCSV([])).toThrow() })
})

describe('exportScenariosCSV', () => {
  it('exports', () => {
    exportScenariosCSV([{ name: 'A', company: 'B', startDate: '2026-03-01', grossAnnualSalary: 120000, usState: 'CA', taxRatePct: 25 }], [{ runwayChange: 15.5 }])
    expect(mockLink.click).toHaveBeenCalled()
  })
  it('throws when empty', () => { expect(() => exportScenariosCSV([])).toThrow() })
})

describe('exportBurndownPDF', () => {
  it('throws when no data', async () => {
    await expect(exportBurndownPDF({ burndown: null })).rejects.toThrow('No burndown data to export')
    await expect(exportBurndownPDF({ burndown: { dataPoints: [] } })).rejects.toThrow('No burndown data to export')
  })
})

describe('exportBurndownPDF', () => {
  it('throws error when no burndown data provided', async () => {
    await expect(exportBurndownPDF({ burndown: null })).rejects.toThrow('No burndown data to export')
    await expect(exportBurndownPDF({ burndown: { dataPoints: [] } })).rejects.toThrow('No burndown data to export')
  })
})
