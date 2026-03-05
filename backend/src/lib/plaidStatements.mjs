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

/**
 * Convert a single Plaid transaction to hub transaction format.
 */
function transformTransaction(plaidTxn) {
  let category = mapPlaidCategory(plaidTxn.personal_finance_category)

  // Upgrade generic venmo/other transfers to 'transfer' when the description
  // matches internal-transfer patterns (e.g. "Withdrawal Home Banking Transfer To Share")
  if (category !== 'transfer') {
    const desc = `${plaidTxn.name || ''} ${plaidTxn.merchant_name || ''}`
    if (isInternalTransferDesc(desc)) {
      category = 'transfer'
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

  // 7. Rebuild index entries for all touched statements
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
