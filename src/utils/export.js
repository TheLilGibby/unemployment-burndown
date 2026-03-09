import dayjs from 'dayjs'
import { formatCurrency, formatDate, formatMonths } from './formatters'

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
    Description: expense.description || '',
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
    Description: account.description || '',
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
 * Export transactions data as CSV
 */
export function exportTransactionsCSV(transactions, filename = null) {
  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions to export')
  }

  const csvData = transactions.map(txn => ({
    Date: txn.date || '',
    Merchant: txn.merchantName || txn.description || '',
    Category: txn.category || '',
    Amount: txn.amount != null ? txn.amount.toFixed(2) : '0.00',
    Account: txn.accountName || '',
    Status: txn.pending ? 'Pending' : 'Cleared',
  }))

  const csv = arrayToCSV(csvData)
  const fname = filename || `transactions-${dayjs().format('YYYY-MM-DD')}.csv`
  downloadFile(csv, fname)
}

/**
 * Export all financial data as a comprehensive CSV bundle (creates multiple files)
 */
export function exportAllData(data) {
  const timestamp = dayjs().format('YYYY-MM-DD_HHmmss')
  
  if (data.burndown && data.burndown.dataPoints && data.burndown.dataPoints.length > 0) {
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
  
  if (data.creditCards && data.creditCards.length > 0) {
    exportCreditCardsCSV(data.creditCards, `credit-cards-${timestamp}.csv`)
  }

  if (data.investments && data.investments.length > 0) {
    exportInvestmentsCSV(data.investments, `investments-${timestamp}.csv`)
  }
}

/**
 * Export income sources as CSV
 */
export function exportIncomeCSV(incomeItems, filename = null) {
  if (!incomeItems || incomeItems.length === 0) {
    throw new Error('No income data to export')
  }

  const csvData = incomeItems.map(item => ({
    Name: item.name || item.source || '',
    'Monthly Amount': (Number(item.monthlyAmount) || 0).toFixed(2),
    Description: item.description || '',
  }))

  const csv = arrayToCSV(csvData)
  const fname = filename || `income-${dayjs().format('YYYY-MM-DD')}.csv`
  downloadFile(csv, fname)
}

/**
 * Export credit cards data as CSV
 */
export function exportCreditCardsCSV(creditCards, filename = null) {
  if (!creditCards || creditCards.length === 0) {
    throw new Error('No credit card data to export')
  }

  const csvData = creditCards.map(card => ({
    Name: card.cardName || card.name || '',
    Balance: card.balance != null ? Number(card.balance).toFixed(2) : '0.00',
    Limit: card.limit != null ? Number(card.limit).toFixed(2) : '0.00',
    APR: card.apr != null ? `${card.apr}%` : '',
    'Min Payment': card.minPayment != null ? Number(card.minPayment).toFixed(2) : '0.00',
    Institution: card.institution || '',
    Active: card.active ? 'Yes' : 'No',
  }))

  const csv = arrayToCSV(csvData)
  const fname = filename || `credit-cards-${dayjs().format('YYYY-MM-DD')}.csv`
  downloadFile(csv, fname)
}

/**
 * Export investments data as CSV
 */
export function exportInvestmentsCSV(investments, filename = null) {
  if (!investments || investments.length === 0) {
    throw new Error('No investment data to export')
  }

  const csvData = investments.map(inv => ({
    Name: inv.name || '',
    Type: inv.type || '',
    'Current Value': inv.currentValue != null ? Number(inv.currentValue).toFixed(2) : '0.00',
    'Cost Basis': inv.costBasis != null ? Number(inv.costBasis).toFixed(2) : '0.00',
    Institution: inv.institution || '',
    Active: inv.active ? 'Yes' : 'No',
  }))

  const csv = arrayToCSV(csvData)
  const fname = filename || `investments-${dayjs().format('YYYY-MM-DD')}.csv`
  downloadFile(csv, fname)
}

/**
 * Export full application state as JSON backup
 */
export function exportFullBackupJSON(state, filename = null) {
  const backup = {
    version: '1.0',
    exportDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    data: state,
  }

  const json = JSON.stringify(backup, null, 2)
  const fname = filename || `financial-backup-${dayjs().format('YYYY-MM-DD')}.json`
  downloadFile(json, fname, 'application/json')
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
