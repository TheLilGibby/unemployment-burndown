/**
 * Transforms Plaid transactions into hub-compatible statements and
 * merges them into S3 (org-scoped).
 *
 * Transactions are grouped by account_id + YYYY-MM month.
 * Each group becomes one statement file: plaid_{accountId}_{YYYY-MM}.json
 *
 * Supports incremental sync: added/modified/removed transactions are
 * merged into existing statement files without duplication.
 */

import { mapPlaidCategory } from './plaidCategoryMap.mjs'
import {
  readStatement,
  readStatementIndex,
  writeStatement,
  writeStatementIndex,
} from './s3.mjs'

// ── Helpers ──

function lastDayOfMonth(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

// Patterns that indicate an internal (same-source) bank transfer
const INTERNAL_TRANSFER_PATTERNS = [
  /\btransfer\s+(to|from)\s+share\b/i,
  /\bwithdrawal\s+home\s+banking\s+transfer\b/i,
  /\bhome\s+banking\s+transfer\b/i,
  /\bfunds\s+transfer\s+via\s+online\b/i,
  /\binternal\s+transfer\b/i,
  /\baccount\s+transfer\b/i,
  /\btransfer\s+(to|from)\s+(checking|savings|share|money\s*market)\b/i,
  /\bonline\s+transfer\s+(to|from)\b/i,
  /\bmobile\s+transfer\s+(to|from)\b/i,
  /\bauto\s*transfer\b/i,
  /\bdeposit\s+home\s+banking\s+transfer\b/i,
  /\btransfer\s+deposit\b/i,
  /\bxfer\s+(to|from)\s+(checking|savings|share)\b/i,
  /\bsweep\s+(to|from)\b/i,
]

function isInternalTransferDesc(text) {
  return INTERNAL_TRANSFER_PATTERNS.some(p => p.test(text))
}

// Extended patterns for cross-institution / investment transfers (pair detection)
const TRANSFER_CANDIDATE_PATTERNS = [
  ...INTERNAL_TRANSFER_PATTERNS,
  /\bach\s*(transfer|deposit|withdrawal|credit|debit)\b/i,
  /\bwire\s*(transfer|deposit|incoming|outgoing)\b/i,
  /\beft\s*(deposit|withdrawal|transfer)\b/i,
  /\bzelle\b/i, /\bvenmo\b/i, /\bcashapp\b/i, /\bcash\s+app\b/i,
  /\bapple\s+cash\b/i, /\bpaypal\s+(transfer|instant)\b/i,
  /\bcoinbase\b/i, /\brobinhood\b/i, /\bfidelity\b/i, /\bschwab\b/i,
  /\bvanguard\b/i, /\betrade\b/i, /\bameritrade\b/i, /\bbinance\b/i,
  /\bkraken\b/i, /\bgemini\b/i,
  /\bfunds\s+transfer\b/i, /\bbank\s+transfer\b/i,
]

function isTransferCandidateDesc(text) {
  return TRANSFER_CANDIDATE_PATTERNS.some(p => p.test(text))
}

/**
 * Detect transfer pairs across statements. Backend-local version that mirrors
 * the logic in src/utils/transferPairDetector.js.
 */
function detectTransferPairsBackend(statements, maxDayGap = 2) {
  const allTxns = []
  for (const stmt of statements) {
    if (!stmt?.transactions) continue
    for (const txn of stmt.transactions) {
      allTxns.push({ ...txn, _stmtId: stmt.id, _issuer: stmt.issuer || '' })
    }
  }

  const candidates = allTxns.filter(t => {
    if (Math.abs(t.amount || 0) === 0) return false
    const desc = `${t.description || ''} ${t.merchantName || ''}`
    const cat = t.category || ''
    return isInternalTransferDesc(desc) || isTransferCandidateDesc(desc) ||
           cat === 'transfer_general' || cat.startsWith('investments_')
  })

  const byAmount = new Map()
  for (const txn of candidates) {
    const key = Math.abs(txn.amount).toFixed(2)
    if (!byAmount.has(key)) byAmount.set(key, [])
    byAmount.get(key).push(txn)
  }

  const paired = new Set()
  const pairs = []

  for (const [, group] of byAmount) {
    if (group.length < 2) continue
    const positives = group.filter(t => t.amount > 0)
    const negatives = group.filter(t => t.amount < 0)
    const potentialMatches = []

    for (const pos of positives) {
      for (const neg of negatives) {
        if (pos._stmtId === neg._stmtId) continue
        const posDate = new Date(pos.date + 'T00:00:00Z')
        const negDate = new Date(neg.date + 'T00:00:00Z')
        const dayDiff = Math.abs(Math.round((posDate - negDate) / 86400000))
        if (dayDiff > maxDayGap) continue

        let confidence = 50
        if (dayDiff === 0) confidence += 30
        else if (dayDiff === 1) confidence += 15
        else confidence += 5
        if (pos._issuer && neg._issuer && pos._issuer.toLowerCase() === neg._issuer.toLowerCase()) {
          confidence += 15
        }
        const posDesc = `${pos.description || ''} ${pos.merchantName || ''}`
        const negDesc = `${neg.description || ''} ${neg.merchantName || ''}`
        if (isInternalTransferDesc(posDesc) && isInternalTransferDesc(negDesc)) {
          confidence += 5
        }
        potentialMatches.push({ pos, neg, confidence, dayDiff })
      }
    }

    potentialMatches.sort((a, b) => b.confidence - a.confidence || a.dayDiff - b.dayDiff)

    for (const match of potentialMatches) {
      const posId = match.pos.id
      const negId = match.neg.id
      if (!posId || !negId || paired.has(posId) || paired.has(negId)) continue
      paired.add(posId)
      paired.add(negId)
      pairs.push({
        txnAId: posId, txnAStmtId: match.pos._stmtId,
        txnBId: negId, txnBStmtId: match.neg._stmtId,
        pairId: `xfer_pair_${posId}_${negId}`,
        confidence: match.confidence, dayDiff: match.dayDiff,
      })
    }
  }

  return pairs
}

// Generic patterns for credit card payments (bank-side fallback)
const CC_PAYMENT_PATTERNS = [
  /credit\s*card\s*(pmt|payment|pay|autopay)/i,
  /card\s*(payment|pmt)\s*(thank|received|confirmed)?/i,
  /payment,?\s*thank\s*you/i,
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
  /autopay\s*(payment|credit)/i,
]

function isCCPaymentDesc(text) {
  return CC_PAYMENT_PATTERNS.some(p => p.test(text))
}

/**
 * Convert a single Plaid transaction to hub transaction format.
 */
function transformTransaction(plaidTxn) {
  let category = mapPlaidCategory(plaidTxn.personal_finance_category)

  const desc = `${plaidTxn.name || ''} ${plaidTxn.merchant_name || ''}`

  // Upgrade generic transfers to 'transfer_general' when the description
  // matches internal-transfer patterns (e.g. "Withdrawal Home Banking Transfer To Share")
  if (category !== 'transfer_general') {
    if (isInternalTransferDesc(desc)) {
      category = 'transfer_general'
    }
  }

  // Tag credit card payments that Plaid didn't classify as LOAN_PAYMENTS_CREDIT_CARD
  if (category !== 'ccPayment_general' && category !== 'transfer_general') {
    if (isCCPaymentDesc(desc)) {
      category = 'ccPayment_general'
    }
  }

  return {
    id:                 `plaid_txn_${plaidTxn.transaction_id}`,
    date:               plaidTxn.date,
    description:        plaidTxn.name,
    merchantName:       plaidTxn.merchant_name || plaidTxn.name,
    category,
    amount:             plaidTxn.amount,
    isRefund:           plaidTxn.amount < 0,
    pending:            plaidTxn.pending || false,
    plaidTransactionId: plaidTxn.transaction_id,
    paymentChannel:     plaidTxn.payment_channel || null, // "online", "in store", "other"
  }
}

/**
 * Group raw Plaid transactions by account_id + month.
 * Returns Map<groupKey, { accountId, month, transactions[] }>
 */
function groupByAccountMonth(plaidTxns) {
  const groups = new Map()
  for (const txn of plaidTxns) {
    const month = txn.date.slice(0, 7) // "YYYY-MM"
    const key = `${txn.account_id}_${month}`
    if (!groups.has(key)) {
      groups.set(key, { accountId: txn.account_id, month, transactions: [] })
    }
    groups.get(key).transactions.push(txn)
  }
  return groups
}

/**
 * Build a full statement object for a given account + month.
 */
function buildStatement(accountId, month, plaidTxns, accountInfo, cardId) {
  const stmtId = `plaid_${accountId}_${month}`
  const txns = plaidTxns.map(transformTransaction)
  txns.sort((a, b) => a.date.localeCompare(b.date))
  const totalBalance = txns.reduce((sum, t) => sum + t.amount, 0)

  return {
    id:                   stmtId,
    cardId:               cardId,
    plaidAccountId:       accountId,
    issuer:               accountInfo.institutionName || 'Plaid',
    cardLastFour:         accountInfo.mask || null,
    accountName:          accountInfo.name || 'Linked Account',
    accountType:          accountInfo.type,
    accountSubtype:       accountInfo.subtype,
    statementPeriodStart: `${month}-01`,
    statementPeriodEnd:   lastDayOfMonth(month),
    closingDate:          lastDayOfMonth(month),
    statementBalance:     Math.round(totalBalance * 100) / 100,
    transactions:         txns,
    source:               'plaid',
    syncedAt:             new Date().toISOString(),
  }
}

/**
 * Main entry point: merge incoming Plaid transactions into S3 statements.
 *
 * @param {string}   orgId          – Organization ID for S3 scoping
 * @param {object[]} added          – Newly added Plaid transactions
 * @param {object[]} modified       – Modified Plaid transactions
 * @param {object[]} removed        – Removed transactions (only { transaction_id })
 * @param {object}   accountInfoMap – { accountId: { name, mask, type, subtype, institutionName } }
 * @param {object}   cardIdMap      – { plaidAccountId: appCardOrAccountId }
 */
export async function mergeTransactionsIntoStatements(
  orgId, added, modified, removed, accountInfoMap, cardIdMap
) {
  // 1. Group added + modified transactions by account + month
  const allUpserts = [...added, ...modified]
  const groups = groupByAccountMonth(allUpserts)

  // 2. Build a set of removed transaction IDs for fast lookup
  const removedIds = new Set(removed.map(r => r.transaction_id))

  // 3. Read the current statement index
  const index = await readStatementIndex(orgId)

  // 4. Track which statement IDs we've touched
  const touchedStmtIds = new Set()

  // 5. For each account+month group, merge into existing statement or create new one
  for (const [, group] of groups) {
    const stmtId = `plaid_${group.accountId}_${group.month}`
    const accountInfo = accountInfoMap[group.accountId] || {}
    const cardId = cardIdMap[group.accountId] || null

    let existing = await readStatement(orgId, stmtId)

    if (existing) {
      // Build a map of user-modified transactions so we can preserve their overrides
      const userModifiedMap = new Map()
      for (const t of existing.transactions) {
        if (t.userModified && t.plaidTransactionId) {
          userModifiedMap.set(t.plaidTransactionId, t)
        }
      }

      // Remove incoming transaction IDs (will be re-added fresh)
      const incomingIds = new Set(group.transactions.map(t => t.transaction_id))
      existing.transactions = existing.transactions.filter(
        t => !incomingIds.has(t.plaidTransactionId) && !removedIds.has(t.plaidTransactionId)
      )
      // Append fresh versions, preserving user-modified fields
      const freshTxns = group.transactions.map(plaidTxn => {
        const transformed = transformTransaction(plaidTxn)
        const prior = userModifiedMap.get(plaidTxn.transaction_id)
        if (prior && prior.userModifiedFields?.length) {
          // Restore each field the user explicitly set
          for (const field of prior.userModifiedFields) {
            transformed[field] = prior[field]
          }
          transformed.userModified = true
          transformed.userModifiedAt = prior.userModifiedAt
          transformed.userModifiedFields = prior.userModifiedFields
        }
        return transformed
      })
      existing.transactions.push(...freshTxns)
      existing.transactions.sort((a, b) => a.date.localeCompare(b.date))
      existing.statementBalance = Math.round(
        existing.transactions.reduce((s, t) => s + t.amount, 0) * 100
      ) / 100
      existing.syncedAt = new Date().toISOString()
      await writeStatement(orgId, stmtId, existing)
    } else {
      // Brand new statement
      const stmt = buildStatement(
        group.accountId, group.month, group.transactions, accountInfo, cardId
      )
      await writeStatement(orgId, stmtId, stmt)
    }

    touchedStmtIds.add(stmtId)
  }

  // 6. Handle removals for statements that had NO new additions
  if (removedIds.size > 0) {
    for (const entry of index.statements) {
      if (!entry.id.startsWith('plaid_') || touchedStmtIds.has(entry.id)) continue
      const stmt = await readStatement(orgId, entry.id)
      if (!stmt) continue
      const before = stmt.transactions.length
      stmt.transactions = stmt.transactions.filter(
        t => !removedIds.has(t.plaidTransactionId)
      )
      if (stmt.transactions.length !== before) {
        stmt.statementBalance = Math.round(
          stmt.transactions.reduce((s, t) => s + t.amount, 0) * 100
        ) / 100
        stmt.syncedAt = new Date().toISOString()
        await writeStatement(orgId, entry.id, stmt)
        touchedStmtIds.add(entry.id)
      }
    }
  }

  // 7. Detect transfer pairs across all touched statements + their counterparts
  {
    // Read all Plaid statements from index for pair detection
    const plaidEntries = index.statements.filter(s => s.id.startsWith('plaid_'))
    const statementsForPairing = []
    for (const entry of plaidEntries) {
      const stmt = touchedStmtIds.has(entry.id)
        ? await readStatement(orgId, entry.id)
        : await readStatement(orgId, entry.id)
      if (stmt) statementsForPairing.push(stmt)
    }

    const pairs = detectTransferPairsBackend(statementsForPairing)

    if (pairs.length > 0) {
      // Build lookup: txnId → pair metadata
      const pairMap = new Map()
      for (const p of pairs) {
        pairMap.set(p.txnAId, { pairId: p.pairId, counterpartId: p.txnBId, counterpartStmtId: p.txnBStmtId })
        pairMap.set(p.txnBId, { pairId: p.pairId, counterpartId: p.txnAId, counterpartStmtId: p.txnAStmtId })
      }

      // Apply pair metadata to statements
      for (const stmt of statementsForPairing) {
        let modified = false
        for (const txn of stmt.transactions) {
          const info = pairMap.get(txn.id)
          if (!info) continue
          txn.transferPairId = info.pairId
          txn.transferPairTxnId = info.counterpartId
          txn.transferPairStatementId = info.counterpartStmtId

          // Auto-categorize unless user has manually set category
          const userFields = txn.userModifiedFields || []
          if (!userFields.includes('category') && txn.category !== 'transfer_general') {
            txn.category = 'transfer_general'
          }
          modified = true
        }
        if (modified) {
          await writeStatement(orgId, stmt.id, stmt)
          touchedStmtIds.add(stmt.id)
        }
      }
    }
  }

  // 8. Rebuild index entries for all touched statements
  // Remove old entries for touched IDs
  index.statements = index.statements.filter(s => !touchedStmtIds.has(s.id))

  // Re-add from fresh S3 data
  for (const stmtId of touchedStmtIds) {
    const stmt = await readStatement(orgId, stmtId)
    if (!stmt || stmt.transactions.length === 0) continue
    index.statements.push({
      id:               stmt.id,
      cardId:           stmt.cardId,
      plaidAccountId:   stmt.plaidAccountId,
      issuer:           stmt.issuer,
      closingDate:      stmt.closingDate,
      statementBalance: stmt.statementBalance,
      transactionCount: stmt.transactions.length,
      parsedAt:         stmt.syncedAt,
      source:           'plaid',
      accountName:      stmt.accountName,
      accountType:      stmt.accountType,
      accountSubtype:   stmt.accountSubtype || null,
    })
  }

  index.lastUpdated = new Date().toISOString()
  await writeStatementIndex(orgId, index)

  return { statementsUpdated: touchedStmtIds.size }
}
