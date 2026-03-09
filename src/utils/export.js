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
    Balance: point.balance?.toFixed(2) || '0.00',
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

/**
 * Export burndown report as PDF with summary stats, chart image, and expense breakdown
 */
export async function exportBurndownPDF({ burndown, expenses, savingsAccounts, chartElement } = {}, filename = null) {
  if (!burndown || !burndown.dataPoints || burndown.dataPoints.length === 0) {
    throw new Error('No burndown data to export')
  }

  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Header
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Financial Runway Report', margin, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text(`Generated ${dayjs().format('MMMM D, YYYY [at] h:mm A')}`, margin, y)
  doc.setTextColor(0, 0, 0)
  y += 12

  // Summary Stats Box
  const boxHeight = 32
  doc.setFillColor(245, 245, 250)
  doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, 'F')

  const runoutDate = burndown.runoutDate
  const runwayMonths = burndown.totalRunwayMonths
  const netBurn = burndown.currentNetBurn
  const totalSavings = savingsAccounts
    ? savingsAccounts.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    : burndown.dataPoints[0]?.balance || 0

  const stats = [
    { label: 'Runway', value: runwayMonths === null ? 'Indefinite' : formatMonths(runwayMonths) },
    { label: 'Runout Date', value: runoutDate ? formatDate(runoutDate) : 'None' },
    { label: 'Balance', value: formatCurrency(totalSavings) },
    { label: 'Net Burn / Mo', value: formatCurrency(Math.abs(netBurn)) },
  ]

  const statWidth = contentWidth / stats.length
  stats.forEach((stat, i) => {
    const x = margin + statWidth * i + statWidth / 2
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(stat.label, x, y + 10, { align: 'center' })
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(stat.value, x, y + 20, { align: 'center' })
  })
  y += boxHeight + 10

  // Chart Image
  if (chartElement) {
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const aspectRatio = canvas.height / canvas.width
      const imgWidth = contentWidth
      const imgHeight = imgWidth * aspectRatio

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Burndown Projection', margin, y)
      y += 6

      doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
      y += imgHeight + 10
    } catch (_err) {
      doc.setFontSize(10)
      doc.setTextColor(150, 50, 50)
      doc.text('Chart image could not be captured.', margin, y)
      doc.setTextColor(0, 0, 0)
      y += 8
    }
  }

  // Burndown Data Table
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Monthly Projections', margin, y)
  y += 6

  const cols = ['Date', 'Balance', 'Income', 'Net Burn', 'Debt', 'Net Position']
  const colWidths = [30, 28, 25, 25, 25, 30]
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(230, 230, 235)
  doc.rect(margin, y - 3, contentWidth, 7, 'F')
  cols.forEach((col, i) => {
    const x = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
    doc.text(col, x + 2, y + 1)
  })
  y += 7

  doc.setFont('helvetica', 'normal')
  const maxRows = 24
  const points = burndown.dataPoints.slice(0, maxRows)
  points.forEach((point, idx) => {
    if (y > 270) {
      doc.addPage()
      y = margin
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 252)
      doc.rect(margin, y - 3, contentWidth, 6, 'F')
    }
    const row = [
      point.dateLabel || '',
      formatCurrency(point.balance),
      formatCurrency(point.income || 0),
      formatCurrency(point.netBurn || 0),
      formatCurrency(point.totalDebt || 0),
      formatCurrency(point.netPosition || 0),
    ]
    doc.setTextColor(30, 30, 30)
    row.forEach((val, i) => {
      const x = margin + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
      doc.text(val, x + 2, y + 1)
    })
    y += 6
  })

  if (burndown.dataPoints.length > maxRows) {
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`... ${burndown.dataPoints.length - maxRows} additional months not shown`, margin, y + 2)
    doc.setTextColor(0, 0, 0)
    y += 8
  }

  y += 6

  // Expense Breakdown
  if (expenses && expenses.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = margin
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Monthly Expenses', margin, y)
    y += 6

    const expCols = ['Expense', 'Amount', 'Essential']
    const expColWidths = [80, 40, 30]
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(230, 230, 235)
    doc.rect(margin, y - 3, contentWidth, 7, 'F')
    expCols.forEach((col, i) => {
      const x = margin + expColWidths.slice(0, i).reduce((a, b) => a + b, 0)
      doc.text(col, x + 2, y + 1)
    })
    y += 7

    doc.setFont('helvetica', 'normal')
    const sortedExpenses = [...expenses].sort((a, b) => (b.monthlyAmount || 0) - (a.monthlyAmount || 0))
    sortedExpenses.forEach((exp, idx) => {
      if (y > 270) {
        doc.addPage()
        y = margin
      }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 252)
        doc.rect(margin, y - 3, contentWidth, 6, 'F')
      }
      const row = [
        (exp.name || exp.label || '').substring(0, 40),
        formatCurrency(exp.monthlyAmount || exp.amount || 0),
        exp.essential ? 'Yes' : 'No',
      ]
      doc.setTextColor(30, 30, 30)
      row.forEach((val, i) => {
        const x = margin + expColWidths.slice(0, i).reduce((a, b) => a + b, 0)
        doc.text(val, x + 2, y + 1)
      })
      y += 6
    })

    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.monthlyAmount) || Number(e.amount) || 0), 0)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('Total:', margin + 2, y + 2)
    doc.text(formatCurrency(totalExpenses), margin + expColWidths[0] + 2, y + 2)
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 160)
    doc.text(
      'Unemployment Burndown \u2014 Financial Runway Report',
      margin,
      doc.internal.pageSize.getHeight() - 10
    )
    doc.text(
      `Page ${p} of ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    )
  }

  const fname = filename || `burndown-report-${dayjs().format('YYYY-MM-DD')}.pdf`
  doc.save(fname)
}
