import dayjs from 'dayjs'
import { CC_PAYMENT_STATEMENT_TOLERANCE, CC_PAYMENT_BALANCE_TOLERANCE } from '../constants/financial'

/**
 * Patterns that match credit card payment transactions in bank statements.
 * These are common merchant names/descriptions for CC payments.
 */
const CC_PAYMENT_PATTERNS = [
  /chase\s*(card|payment|credit|autopay)/i,
  /citi\s*(card|pay|auto|credit)/i,
  /amex\s*(payment|epay|autopay)/i,
  /american\s*express\s*(payment|epay)/i,
  /capital\s*one\s*(payment|auto|credit)/i,
  /discover\s*(payment|auto|credit)/i,
  /barclays?\s*(payment|auto|credit)/i,
  /wells\s*fargo\s*(card|credit|payment)/i,
  /bank\s*of\s*america\s*(card|credit|payment)/i,
  /synchrony\s*(payment|auto)/i,
  /credit\s*card\s*(pmt|payment|pay|autopay)/i,
  /card\s*(payment|pmt)\s*(thank|received|confirmed)?/i,
  /online\s*(payment|transfer).*credit/i,
  /autopay\s*(payment|credit)/i,
  /payment,?\s*thank\s*you/i,
]

/**
 * Check if a transaction description/merchant looks like a credit card payment.
 * (Pattern-matching only — bank-side fallback.)
 * @param {object} txn - Transaction with description, merchantName
 * @returns {boolean}
 */
export function isCCPaymentTransaction(txn) {
  const text = `${txn.description || ''} ${txn.merchantName || ''}`.toLowerCase()
  return CC_PAYMENT_PATTERNS.some(p => p.test(text))
}

/**
 * Structural detection: identifies CC payments without pattern matching.
 * - Credit-account side: negative amount on a credit account = payment received
 * - Already tagged by Plaid category map (LOAN_PAYMENTS_CREDIT_CARD → ccPayment)
 */
export function isCCPaymentStructural(txn) {
  if (txn.accountType === 'credit' && txn.amount < 0) return true
  if (txn.category === 'ccPayment' || txn.category === 'ccPayment_general') return true
  return false
}

/**
 * Unified CC payment detector — combines structural signals + pattern matching.
 * Use this as the single entry point for all CC payment detection.
 */
export function isCCPayment(txn) {
  return isCCPaymentStructural(txn) || isCCPaymentTransaction(txn)
}

/**
 * Detect credit card payment transactions in bank (depository) statements
 * and match them to specific credit cards.
 *
 * @param {Array} bankTransactions - Transactions from depository accounts
 * @param {Array} creditCards - Credit card objects with id, name, balance
 * @param {Array} ccStatements - Statement index entries for credit cards
 * @returns {Array} Detected payments with { bankTxn, matchedCardId, matchedCardName, confidence }
 */
export function detectCCPayments(bankTransactions, creditCards, ccStatements = []) {
  const results = []

  for (const txn of bankTransactions) {
    if (!isCCPaymentTransaction(txn)) continue

    const text = `${txn.description || ''} ${txn.merchantName || ''}`.toLowerCase()
    const amount = Math.abs(txn.amount || 0)
    if (amount === 0) continue

    let bestMatch = null
    let bestConfidence = 0

    for (const card of creditCards) {
      let confidence = 0
      const cardName = (card.name || '').toLowerCase()
      const issuer = cardName.split(/\s+/)[0] // first word often is issuer

      // Name matching: does the txn mention the card's issuer/name?
      if (issuer && text.includes(issuer)) confidence += 40

      // Last 4 matching
      if (card.last4 && text.includes(card.last4)) confidence += 30

      // Amount matching: does the txn amount match a statement balance?
      const cardStatements = ccStatements.filter(s => s.cardId === card.id)
      for (const stmt of cardStatements) {
        const stmtBal = Math.abs(stmt.statementBalance || 0)
        if (stmtBal > 0 && Math.abs(amount - stmtBal) / stmtBal < CC_PAYMENT_STATEMENT_TOLERANCE) {
          confidence += 25
          // Date proximity to statement close
          const closingDate = dayjs(stmt.closingDate)
          const txnDate = dayjs(txn.date)
          if (txnDate.isValid() && closingDate.isValid()) {
            const daysDiff = Math.abs(txnDate.diff(closingDate, 'day'))
            if (daysDiff <= 7) confidence += 10
          }
          break
        }
      }

      // Balance proximity: does the amount roughly match current balance?
      const cardBal = Number(card.balance) || 0
      if (cardBal > 0 && Math.abs(amount - cardBal) / cardBal < CC_PAYMENT_BALANCE_TOLERANCE) {
        confidence += 15
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence
        bestMatch = card
      }
    }

    results.push({
      bankTxn: txn,
      matchedCardId: bestMatch?.id || null,
      matchedCardName: bestMatch?.name || null,
      confidence: bestConfidence,
      amount,
    })
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}
