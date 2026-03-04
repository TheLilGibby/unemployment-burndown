/**
 * Patterns that match internal / same-source bank transfers.
 * These are moves between the user's own accounts at the same institution
 * (e.g. checking → savings, share → share, etc.).
 */
const INTERNAL_TRANSFER_PATTERNS = [
  // Credit union share transfers
  /\btransfer\s+(to|from)\s+share\b/i,
  /\bwithdrawal\s+home\s+banking\s+transfer\b/i,
  /\bhome\s+banking\s+transfer\b/i,
  /\bfunds\s+transfer\s+via\s+online\b/i,

  // Generic internal / account-to-account
  /\binternal\s+transfer\b/i,
  /\baccount\s+transfer\b/i,
  /\btransfer\s+(to|from)\s+(checking|savings|share|money\s*market)\b/i,
  /\bonline\s+transfer\s+(to|from)\b/i,
  /\bmobile\s+transfer\s+(to|from)\b/i,
  /\bauto\s*transfer\b/i,

  // Deposit-side of the same transfer
  /\bdeposit\s+home\s+banking\s+transfer\b/i,
  /\btransfer\s+deposit\b/i,
  /\bxfer\s+(to|from)\s+(checking|savings|share)\b/i,
  /\bsweep\s+(to|from)\b/i,
]

/**
 * Check if a transaction looks like an internal (same-source) transfer.
 *
 * @param {object} txn - Transaction with description, merchantName, category
 * @returns {boolean}
 */
export function isInternalTransfer(txn) {
  const text = `${txn.description || ''} ${txn.merchantName || ''}`
  if (INTERNAL_TRANSFER_PATTERNS.some(p => p.test(text))) return true
  // Also match if already categorised as 'transfer' (e.g. by Plaid mapping)
  if (txn.category === 'transfer') return true
  return false
}
