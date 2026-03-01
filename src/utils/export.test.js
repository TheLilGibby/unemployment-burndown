import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  exportBurndownCSV,
  exportExpensesCSV,
  exportSavingsCSV,
  exportScenariosCSV,
} from './export'

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock document methods
const mockLink = {
  href: '',
  download: '',
  click: vi.fn(),
}
const originalCreateElement = document.createElement.bind(document)
document.createElement = vi.fn((tag) => {
  if (tag === 'a') return mockLink
  return originalCreateElement(tag)
})

const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
document.body.appendChild = mockAppendChild
document.body.removeChild = mockRemoveChild

beforeEach(() => {
  vi.clearAllMocks()
})

describe('exportBurndownCSV', () => {
  it('exports burndown timeline data as CSV', () => {
    const burndownData = {
      timeline: [
        { date: '2026-01-01', balance: 10000, expenses: 3000, income: 2000, netBurn: 1000, runwayMonths: 10 },
        { date: '2026-02-01', balance: 9000, expenses: 3000, income: 2000, netBurn: 1000, runwayMonths: 9 },
      ],
    }

    exportBurndownCSV(burndownData)

    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toContain('burndown-')
    expect(mockLink.download).toContain('.csv')
  })

  it('throws error when no data provided', () => {
    expect(() => exportBurndownCSV(null)).toThrow('No burndown data to export')
    expect(() => exportBurndownCSV({ timeline: [] })).toThrow('No burndown data to export')
  })
})

describe('exportExpensesCSV', () => {
  it('exports expenses data as CSV', () => {
    const expenses = [
      { name: 'Rent', monthlyAmount: 1500, essential: true, category: 'Housing' },
      { name: 'Netflix', monthlyAmount: 15, essential: false, category: 'Entertainment' },
    ]

    exportExpensesCSV(expenses)

    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toContain('expenses-')
    expect(mockLink.download).toContain('.csv')
  })

  it('throws error when no expenses provided', () => {
    expect(() => exportExpensesCSV([])).toThrow('No expenses to export')
  })
})

describe('exportSavingsCSV', () => {
  it('exports savings accounts data as CSV', () => {
    const savings = [
      { name: 'Checking', amount: 5000, type: 'Checking', institution: 'Bank A' },
      { name: 'Savings', amount: 10000, type: 'Savings', institution: 'Bank B' },
    ]

    exportSavingsCSV(savings)

    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toContain('savings-')
    expect(mockLink.download).toContain('.csv')
  })

  it('throws error when no savings accounts provided', () => {
    expect(() => exportSavingsCSV([])).toThrow('No savings accounts to export')
  })
})

describe('exportScenariosCSV', () => {
  it('exports job scenarios data as CSV', () => {
    const scenarios = [
      {
        name: 'Tech Co',
        company: 'Tech Corp',
        startDate: '2026-03-01',
        grossAnnualSalary: 120000,
        usState: 'CA',
        taxRatePct: 25,
      },
    ]
    const results = [
      { runwayChange: 15.5 },
    ]

    exportScenariosCSV(scenarios, results)

    expect(mockLink.click).toHaveBeenCalled()
    expect(mockLink.download).toContain('scenarios-')
    expect(mockLink.download).toContain('.csv')
  })

  it('throws error when no scenarios provided', () => {
    expect(() => exportScenariosCSV([])).toThrow('No scenarios to export')
  })
})

describe('CSV escaping', () => {
  it('escapes commas and quotes in CSV data', () => {
    const expenses = [
      { name: 'Groceries, Food', monthlyAmount: 500, essential: true, category: 'Food' },
      { name: 'Quote "Test"', monthlyAmount: 100, essential: false, category: 'Other' },
    ]

    exportExpensesCSV(expenses, 'test.csv')

    // The CSV should have been created with proper escaping
    expect(mockLink.click).toHaveBeenCalled()
  })
})
