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

const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
document.body.appendChild = mockAppendChild
document.body.removeChild = mockRemoveChild

beforeEach(() => { vi.clearAllMocks() })

describe('exportBurndownCSV', () => {
  it('exports burndown dataPoints as CSV', () => {
    const data = {
      dataPoints: [
        { date: '2026-01-01', dateLabel: 'Jan 2026', balance: 10000, income: 2000, netBurn: 1000, totalDebt: 500, netPosition: 9500, inBenefitWindow: true, jobActive: false },
      ],
    }
    exportBurndownCSV(data)
    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toContain('.csv')
  })

  it('throws error when no data provided', () => {
    expect(() => exportBurndownCSV(null)).toThrow('No burndown data to export')
    expect(() => exportBurndownCSV({ dataPoints: [] })).toThrow('No burndown data to export')
  })
})

describe('exportExpensesCSV', () => {
  it('exports expenses', () => {
    exportExpensesCSV([{ name: 'Rent', monthlyAmount: 1500, essential: true, category: 'Housing' }])
    expect(mockLink.click).toHaveBeenCalled()
  })
  it('throws error when empty', () => {
    expect(() => exportExpensesCSV([])).toThrow('No expenses to export')
  })
})

describe('exportSavingsCSV', () => {
  it('exports savings', () => {
    exportSavingsCSV([{ name: 'Checking', amount: 5000, type: 'Checking', institution: 'Bank A' }])
    expect(mockLink.click).toHaveBeenCalled()
  })
  it('throws error when empty', () => {
    expect(() => exportSavingsCSV([])).toThrow('No savings accounts to export')
  })
})

describe('exportScenariosCSV', () => {
  it('exports scenarios', () => {
    exportScenariosCSV([{ name: 'Tech Co', company: 'Corp', startDate: '2026-03-01', grossAnnualSalary: 120000, usState: 'CA', taxRatePct: 25 }], [{ runwayChange: 15.5 }])
    expect(mockLink.click).toHaveBeenCalled()
  })
  it('throws error when empty', () => {
    expect(() => exportScenariosCSV([])).toThrow('No scenarios to export')
  })
})

describe('exportBurndownPDF', () => {
  it('throws error when no burndown data provided', async () => {
    await expect(exportBurndownPDF({ burndown: null })).rejects.toThrow('No burndown data to export')
    await expect(exportBurndownPDF({ burndown: { dataPoints: [] } })).rejects.toThrow('No burndown data to export')
  })
})
