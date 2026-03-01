import dayjs from 'dayjs'
import { formatCurrency, formatDate } from './formatters'

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data, headers) {
  if (!data || data.length === 0) return ''
  
  const keys = headers || Object.keys(data[0])
  const csvHeaders = keys.join(',')
  
  const csvRows = data.map(row => {
    return keys.map(key => {
      const value = row[key]
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = value != null ? String(value) : ''
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  })
  
  return [csvHeaders, ...csvRows].join('\n')
}

/**
 * Trigger browser download of a file
 */
function downloadFile(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export burndown timeline data as CSV
 */
export function exportBurndownCSV(burndownData, filename = null) {
  if (!burndownData || !burndownData.timeline || burndownData.timeline.length === 0) {
    throw new Error('No burndown data to export')
  }
  
  const csvData = burndownData.timeline.map(point => ({
    Date: formatDate(point.date),
    Balance: point.balance.toFixed(2),
    'Monthly Expenses': point.expenses?.toFixed(2) || '0.00',
    'Monthly Income': point.income?.toFixed(2) || '0.00',
    'Net Burn': point.netBurn?.toFixed(2) || '0.00',
    'Runway (Months)': point.runwayMonths?.toFixed(1) || '0.0',
  }))
  
  const csv = arrayToCSV(csvData)
  const fname = filename || `burndown-${dayjs().format('YYYY-MM-DD')}.csv`
  downloadFile(csv, fname)
}

/**
 * Export expenses data as CSV
 */
export function exportExpensesCSV(expenses, filename = null) {
  if (!expenses || expenses.length === 0) {
    throw new Error('No expenses to export')
  }
  
  const csvData = expenses.map(expense => ({
    Name: expense.name || expense.label || '',
    Amount: expense.monthlyAmount?.toFixed(2) || expense.amount?.toFixed(2) || '0.00',
    Essential: expense.essential ? 'Yes' : 'No',
    Category: expense.category || '',
    Notes: expense.notes || '',
  }))
  
  const csv = arrayToCSV(csvData)
  const fname = filename || `expenses-${dayjs().format('YYYY-MM-DD')}.csv`
  downloadFile(csv, fname)
}

/**
 * Export savings accounts data as CSV
 */
export function exportSavingsCSV(savingsAccounts, filename = null) {
  if (!savingsAccounts || savingsAccounts.length === 0) {
    throw new Error('No savings accounts to export')
  }
  
  const csvData = savingsAccounts.map(account => ({
    Name: account.name || '',
    Balance: account.amount?.toFixed(2) || '0.00',
    Type: account.type || '',
    Institution: account.institution || '',
    Notes: account.notes || '',
  }))
  
  const csv = arrayToCSV(csvData)
  const fname = filename || `savings-${dayjs().format('YYYY-MM-DD')}.csv`
  downloadFile(csv, fname)
}

/**
 * Export job scenarios data as CSV
 */
export function exportScenariosCSV(scenarios, results, filename = null) {
  if (!scenarios || scenarios.length === 0) {
    throw new Error('No scenarios to export')
  }
  
  const csvData = scenarios.map((scenario, idx) => {
    const result = results?.[idx]
    return {
      Name: scenario.name || '',
      Company: scenario.company || '',
      'Start Date': formatDate(scenario.startDate),
      'Annual Salary': scenario.grossAnnualSalary?.toFixed(2) || '0.00',
      State: scenario.usState || '',
      'Tax Rate %': scenario.taxRatePct?.toFixed(1) || '0.0',
      'Savings Allocation': scenario.savingsAllocation?.toFixed(2) || '0.00',
      'Investment Allocation': scenario.investmentAllocation?.toFixed(2) || '0.00',
      'Retirement %': scenario.retirementPct?.toFixed(1) || '0.0',
      'Runway Impact (Months)': result?.runwayChange?.toFixed(1) || 'N/A',
    }
  })
  
  const csv = arrayToCSV(csvData)
  const fname = filename || `scenarios-${dayjs().format('YYYY-MM-DD')}.csv`
  downloadFile(csv, fname)
}

/**
 * Export all financial data as a comprehensive CSV bundle (creates multiple files)
 */
export function exportAllData(data) {
  const timestamp = dayjs().format('YYYY-MM-DD_HHmmss')
  
  if (data.burndown && data.burndown.timeline && data.burndown.timeline.length > 0) {
    exportBurndownCSV(data.burndown, `burndown-${timestamp}.csv`)
  }
  
  if (data.expenses && data.expenses.length > 0) {
    exportExpensesCSV(data.expenses, `expenses-${timestamp}.csv`)
  }
  
  if (data.savingsAccounts && data.savingsAccounts.length > 0) {
    exportSavingsCSV(data.savingsAccounts, `savings-${timestamp}.csv`)
  }
  
  if (data.scenarios && data.scenarios.length > 0) {
    exportScenariosCSV(data.scenarios, data.scenarioResults, `scenarios-${timestamp}.csv`)
  }
  
  // Add more exports as needed (income, assets, etc.)
}

/**
 * Export comprehensive summary as JSON
 */
export function exportSummaryJSON(data, filename = null) {
  const summary = {
    exportDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    totalSavings: data.totalSavings || 0,
    monthlyExpenses: data.monthlyExpenses || 0,
    monthlyIncome: data.monthlyIncome || 0,
    runwayMonths: data.runwayMonths || 0,
    runoutDate: data.runoutDate || null,
    expenses: data.expenses || [],
    savingsAccounts: data.savingsAccounts || [],
    scenarios: data.scenarios || [],
    unemployment: data.unemployment || {},
  }
  
  const json = JSON.stringify(summary, null, 2)
  const fname = filename || `financial-summary-${dayjs().format('YYYY-MM-DD')}.json`
  downloadFile(json, fname, 'application/json')
}
