import dayjs from 'dayjs'

/**
 * Given a detected CC payment (bank transaction) and the matched card,
 * find the credit card statement whose period best covers that payment
 * and return its individual transactions as the "picklist".
 *
 * This closes the financial-flow gap: bank lump-sum payment → individual CC charges.
 *
 * @param {object} opts
 * @param {object} opts.bankTxn         - The bank transaction detected as a CC payment
 * @param {number|null} opts.matchedCardId - Card ID from detectCCPayments
 * @param {Array}  opts.statementIndex  - Statement index entries (index.statements)
 * @param {object} opts.statements      - Map of statementId → full statement (with transactions)
 * @returns {{ statement: object|null, transactions: Array, coverage: object }}
 */
export function picklistForCCPayment({ bankTxn, matchedCardId, statementIndex = [], statements = {} }) {
  if (!bankTxn || !matchedCardId) return { statement: null, transactions: [], coverage: null }

  const paymentDate = dayjs(bankTxn.date)
  const paymentAmount = Math.abs(bankTxn.amount || 0)
  if (!paymentDate.isValid() || paymentAmount === 0) return { statement: null, transactions: [], coverage: null }

  // Find all statements for this card
  const cardStatements = statementIndex
    .filter(s => s.cardId === matchedCardId)
    .sort((a, b) => (b.closingDate || '').localeCompare(a.closingDate || ''))

  if (cardStatements.length === 0) return { statement: null, transactions: [], coverage: null }

  // Score each statement to find the best match for this payment
  let bestStmt = null
  let bestScore = -Infinity

  for (const stmtMeta of cardStatements) {
    let score = 0
    const closingDate = dayjs(stmtMeta.closingDate)

    // Amount match — how close is the payment to the statement balance?
    const stmtBal = Math.abs(stmtMeta.statementBalance || 0)
    if (stmtBal > 0) {
      const amountRatio = Math.abs(paymentAmount - stmtBal) / stmtBal
      if (amountRatio < 0.01) score += 50      // near-exact match
      else if (amountRatio < 0.05) score += 35  // very close
      else if (amountRatio < 0.15) score += 20  // reasonable
    }

    // Date proximity — payments usually happen within ~30 days of closing
    if (closingDate.isValid()) {
      const daysDiff = paymentDate.diff(closingDate, 'day')
      // Payment should be AFTER closing date, within typical billing window
      if (daysDiff >= 0 && daysDiff <= 30) score += 40
      else if (daysDiff >= -5 && daysDiff <= 45) score += 20
      else if (Math.abs(daysDiff) <= 60) score += 5
    }

    if (score > bestScore) {
      bestScore = score
      bestStmt = stmtMeta
    }
  }

  if (!bestStmt) {
    // Fallback: pick the statement with the closest closing date before the payment
    bestStmt = cardStatements.find(s => {
      const cd = dayjs(s.closingDate)
      return cd.isValid() && cd.isBefore(paymentDate.add(5, 'day'))
    }) || cardStatements[0]
  }

  // Get full statement with transactions
  const fullStmt = statements[bestStmt.id]
  const txns = fullStmt?.transactions || []

  // Build coverage summary
  const chargeTotal = txns
    .filter(t => (t.amount || 0) > 0)
    .reduce((sum, t) => sum + (t.amount || 0), 0)
  const refundTotal = txns
    .filter(t => (t.amount || 0) < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)
  const netTotal = chargeTotal - refundTotal

  const coverage = {
    paymentAmount,
    statementBalance: Math.abs(bestStmt.statementBalance || 0),
    chargeTotal,
    refundTotal,
    netTotal,
    transactionCount: txns.length,
    difference: paymentAmount - netTotal,
    matchScore: bestScore,
    closingDate: bestStmt.closingDate,
    statementId: bestStmt.id,
  }

  return {
    statement: bestStmt,
    transactions: txns,
    coverage,
  }
}

/**
 * Summarize category breakdown for picklist transactions.
 * @param {Array} transactions
 * @returns {Array<{ category: string, total: number, count: number }>} sorted by total desc
 */
export function summarizePicklistByCategory(transactions) {
  const byCategory = {}
  for (const txn of transactions) {
    const cat = txn.category || 'other'
    if (!byCategory[cat]) byCategory[cat] = { category: cat, total: 0, count: 0 }
    byCategory[cat].total += Math.abs(txn.amount || 0)
    byCategory[cat].count += 1
  }
  return Object.values(byCategory).sort((a, b) => b.total - a.total)
}
