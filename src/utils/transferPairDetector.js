import dayjs from 'dayjs'
import { isInternalTransfer } from './transferDetector'
import { TRANSFER_MAX_DAY_GAP } from '../constants/financial'

/**
 * Extended patterns for cross-institution and investment platform transfers.
 * These supplement the base isInternalTransfer() patterns from transferDetector.js.
 */
const CROSS_INSTITUTION_PATTERNS = [
  // ACH / Wire
  /\bach\s*(transfer|deposit|withdrawal|credit|debit)\b/i,
  /\bwire\s*(transfer|deposit|incoming|outgoing)\b/i,
  /\beft\s*(deposit|withdrawal|transfer)\b/i,
  /\bdirect\s+dep(osit)?\b/i,

  // P2P services (may appear on both sender and receiver bank statements)
  /\bzelle\b/i,
  /\bvenmo\b/i,
  /\bcashapp\b/i,
  /\bcash\s+app\b/i,
  /\bapple\s+cash\b/i,
  /\bpaypal\s+(transfer|instant)\b/i,

  // Investment / crypto platforms
  /\bcoinbase\b/i,
  /\brobinhood\b/i,
  /\bfidelity\b/i,
  /\bschwab\b/i,
  /\bvanguard\b/i,
  /\betrade\b/i,
  /\bameritrade\b/i,
  /\binteractive\s+brokers\b/i,
  /\bbinance\b/i,
  /\bkraken\b/i,
  /\bgemini\b/i,

  // Generic fund movement keywords
  /\bfunds\s+transfer\b/i,
  /\baccount\s+funding\b/i,
  /\bbank\s+transfer\b/i,
]

/**
 * Check if a transaction is a transfer candidate — either by base internal-transfer
 * detection or by matching extended cross-institution/investment patterns.
 */
export function isTransferCandidate(txn) {
  if (isInternalTransfer(txn)) return true

  // Already categorized as transfer or investment
  const cat = txn.category || ''
  if (cat === 'transfer_general' || cat.startsWith('investments_')) return true

  const text = `${txn.description || ''} ${txn.merchantName || ''}`
  return CROSS_INSTITUTION_PATTERNS.some(p => p.test(text))
}

/**
 * Detect transfer pairs across multiple statements.
 *
 * Scans all transactions, finds candidates, and pairs them by:
 *   - Same absolute amount (exact match)
 *   - Same date or within `maxDayGap` days
 *   - Opposite sign (one positive, one negative)
 *   - Different account/statement
 *
 * @param {Array} statements - Array of statement objects, each with .id, .transactions[]
 * @param {object} opts
 * @param {number} opts.maxDayGap - Max days between paired transactions (default 2)
 * @returns {Array<TransferPair>}
 *
 * @typedef {object} TransferPair
 * @property {object} txnA - { statementId, transactionId, date, amount, description, accountName }
 * @property {object} txnB - { statementId, transactionId, date, amount, description, accountName }
 * @property {number} confidence - 0–100 match confidence
 * @property {number} dayDiff - Absolute day difference between the two
 * @property {string} pairId - Unique identifier for this pair
 */
export function detectTransferPairs(statements, opts = {}) {
  const { maxDayGap = TRANSFER_MAX_DAY_GAP } = opts

  // 1. Flatten all transactions, tagged with their statement context
  const allTxns = []
  for (const stmt of statements) {
    if (!stmt?.transactions) continue
    for (const txn of stmt.transactions) {
      allTxns.push({
        ...txn,
        _stmtId: stmt.id,
        _accountName: stmt.accountName || stmt.issuer || stmt.id,
        _plaidAccountId: stmt.plaidAccountId || null,
        _institutionName: stmt.issuer || null,
      })
    }
  }

  // 2. Identify candidates
  const candidates = allTxns.filter(t => isTransferCandidate(t) && Math.abs(t.amount || 0) > 0)

  // 3. Group candidates by absolute amount for efficient pairing
  const byAmount = new Map()
  for (const txn of candidates) {
    const key = String(Math.round(Math.abs(txn.amount) * 100))
    if (!byAmount.has(key)) byAmount.set(key, [])
    byAmount.get(key).push(txn)
  }

  // 4. Find pairs within each amount group
  const paired = new Set() // txn IDs already matched
  const pairs = []

  for (const [, group] of byAmount) {
    if (group.length < 2) continue

    // Separate into positive (withdrawals/debits) and negative (deposits/credits)
    const positives = group.filter(t => t.amount > 0)
    const negatives = group.filter(t => t.amount < 0)

    // Build potential matches, scored
    const potentialMatches = []
    for (const pos of positives) {
      for (const neg of negatives) {
        // Must be from different statements
        if (pos._stmtId === neg._stmtId) continue

        const posDate = dayjs(pos.date)
        const negDate = dayjs(neg.date)
        if (!posDate.isValid() || !negDate.isValid()) continue

        const dayDiff = Math.abs(posDate.diff(negDate, 'day'))
        if (dayDiff > maxDayGap) continue

        // Calculate confidence score
        let confidence = 50 // Base: same amount, opposite sign, within date range

        // Date proximity bonus
        if (dayDiff === 0) confidence += 30
        else if (dayDiff === 1) confidence += 15
        else confidence += 5

        // Same institution bonus
        if (pos._institutionName && neg._institutionName &&
            pos._institutionName.toLowerCase() === neg._institutionName.toLowerCase()) {
          confidence += 15
        }

        // Both already flagged as internal transfer (strong signal)
        if (isInternalTransfer(pos) && isInternalTransfer(neg)) {
          confidence += 5
        }

        potentialMatches.push({ pos, neg, confidence, dayDiff })
      }
    }

    // Sort by confidence (best first), then by dayDiff (closer is better)
    potentialMatches.sort((a, b) => b.confidence - a.confidence || a.dayDiff - b.dayDiff)

    // Greedily assign pairs (each txn can only be in one pair)
    for (const match of potentialMatches) {
      const posId = match.pos.id || `${match.pos._stmtId}_${match.pos.date}_${match.pos.amount}`
      const negId = match.neg.id || `${match.neg._stmtId}_${match.neg.date}_${match.neg.amount}`

      if (paired.has(posId) || paired.has(negId)) continue

      paired.add(posId)
      paired.add(negId)

      const pairId = `xfer_pair_${posId}_${negId}`

      pairs.push({
        txnA: {
          statementId: match.pos._stmtId,
          transactionId: match.pos.id,
          date: match.pos.date,
          amount: match.pos.amount,
          description: match.pos.description || match.pos.merchantName,
          accountName: match.pos._accountName,
        },
        txnB: {
          statementId: match.neg._stmtId,
          transactionId: match.neg.id,
          date: match.neg.date,
          amount: match.neg.amount,
          description: match.neg.description || match.neg.merchantName,
          accountName: match.neg._accountName,
        },
        confidence: match.confidence,
        dayDiff: match.dayDiff,
        pairId,
      })
    }
  }

  return pairs.sort((a, b) => b.confidence - a.confidence)
}

/**
 * Look up whether a transaction is part of a detected pair.
 *
 * @param {string} transactionId
 * @param {Array<TransferPair>} pairs - Output of detectTransferPairs()
 * @returns {{ pair: TransferPair, counterpart: object } | null}
 */
export function findTransferPair(transactionId, pairs) {
  for (const pair of pairs) {
    if (pair.txnA.transactionId === transactionId) {
      return { pair, counterpart: pair.txnB }
    }
    if (pair.txnB.transactionId === transactionId) {
      return { pair, counterpart: pair.txnA }
    }
  }
  return null
}

/**
 * Build a lookup map from transaction ID → pair info for O(1) access.
 *
 * @param {Array<TransferPair>} pairs
 * @returns {Map<string, { pairId: string, counterpart: object, confidence: number }>}
 */
export function buildPairLookup(pairs) {
  const map = new Map()
  for (const pair of pairs) {
    map.set(pair.txnA.transactionId, {
      pairId: pair.pairId,
      counterpart: pair.txnB,
      confidence: pair.confidence,
    })
    map.set(pair.txnB.transactionId, {
      pairId: pair.pairId,
      counterpart: pair.txnA,
      confidence: pair.confidence,
    })
  }
  return map
}

/**
 * Apply transfer pair detection to statements and auto-categorize paired
 * transactions as 'transfer_general'. Does NOT mutate the input.
 *
 * @param {Array} statements - Statement objects
 * @param {object} opts - Options passed to detectTransferPairs
 * @returns {{ statements: Array, pairs: Array<TransferPair> }}
 */
export function applyTransferPairs(statements, opts = {}) {
  const pairs = detectTransferPairs(statements, opts)
  if (pairs.length === 0) return { statements, pairs }

  // Build set of paired transaction IDs
  const pairedIds = new Map()
  for (const pair of pairs) {
    pairedIds.set(pair.txnA.transactionId, {
      pairId: pair.pairId,
      counterpartId: pair.txnB.transactionId,
      counterpartStmtId: pair.txnB.statementId,
    })
    pairedIds.set(pair.txnB.transactionId, {
      pairId: pair.pairId,
      counterpartId: pair.txnA.transactionId,
      counterpartStmtId: pair.txnA.statementId,
    })
  }

  // Create updated statements with pair metadata and auto-categorization
  const updated = statements.map(stmt => {
    if (!stmt?.transactions) return stmt
    let changed = false
    const txns = stmt.transactions.map(txn => {
      const pairInfo = pairedIds.get(txn.id)
      if (!pairInfo) return txn

      changed = true
      const updates = {
        transferPairId: pairInfo.pairId,
        transferPairTxnId: pairInfo.counterpartId,
        transferPairStatementId: pairInfo.counterpartStmtId,
      }

      // Auto-categorize as transfer_general unless user has manually set the category
      const userModifiedFields = txn.userModifiedFields || []
      if (!userModifiedFields.includes('category')) {
        const currentCat = txn.category || ''
        if (currentCat !== 'transfer_general') {
          updates.category = 'transfer_general'
        }
      }

      return { ...txn, ...updates }
    })

    return changed ? { ...stmt, transactions: txns } : stmt
  })

  return { statements: updated, pairs }
}
