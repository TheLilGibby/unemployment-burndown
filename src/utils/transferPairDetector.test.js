import { describe, it, expect } from 'vitest'
import {
  isTransferCandidate,
  detectTransferPairs,
  findTransferPair,
  buildPairLookup,
  applyTransferPairs,
} from './transferPairDetector'

// ── Helpers ──

function makeTxn(overrides = {}) {
  return {
    id: `txn_${Math.random().toString(36).slice(2, 8)}`,
    date: '2025-02-08',
    description: '',
    merchantName: '',
    category: 'other_general',
    amount: 100,
    ...overrides,
  }
}

function makeStmt(id, transactions, extra = {}) {
  return { id, accountName: id, transactions, issuer: 'Test Bank', ...extra }
}

// ── isTransferCandidate ──

describe('isTransferCandidate', () => {
  it('detects internal bank transfers by description', () => {
    expect(isTransferCandidate(makeTxn({
      description: 'Withdrawal Home Banking Transfer To Share 0090',
    }))).toBe(true)
  })

  it('detects Coinbase as transfer candidate', () => {
    expect(isTransferCandidate(makeTxn({
      description: 'Coinbase',
      merchantName: 'Coinbase',
    }))).toBe(true)
  })

  it('detects Zelle as transfer candidate', () => {
    expect(isTransferCandidate(makeTxn({
      description: 'Zelle payment',
    }))).toBe(true)
  })

  it('detects ACH transfers', () => {
    expect(isTransferCandidate(makeTxn({
      description: 'ACH Transfer deposit',
    }))).toBe(true)
  })

  it('detects transactions already categorized as transfer', () => {
    expect(isTransferCandidate(makeTxn({
      category: 'transfer_general',
      description: 'Random description',
    }))).toBe(true)
  })

  it('detects investment category transactions', () => {
    expect(isTransferCandidate(makeTxn({
      category: 'investments_crypto',
      description: 'Random description',
    }))).toBe(true)
  })

  it('does not flag regular purchases', () => {
    expect(isTransferCandidate(makeTxn({
      description: 'Walmart Supercenter',
      merchantName: 'Walmart',
      category: 'shopping_general',
    }))).toBe(false)
  })
})

// ── detectTransferPairs ──

describe('detectTransferPairs', () => {
  it('pairs same-day, same-amount, opposite-sign transfers across accounts', () => {
    const stmtA = makeStmt('checking', [
      makeTxn({ id: 'w1', date: '2025-02-08', amount: 1100, description: 'Withdrawal Home Banking Transfer To Share 0090' }),
    ])
    const stmtB = makeStmt('savings', [
      makeTxn({ id: 'd1', date: '2025-02-08', amount: -1100, description: 'Deposit Home Banking Transfer From Share 0000' }),
    ])

    const pairs = detectTransferPairs([stmtA, stmtB])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].txnA.transactionId).toBe('w1')
    expect(pairs[0].txnB.transactionId).toBe('d1')
    expect(pairs[0].dayDiff).toBe(0)
    expect(pairs[0].confidence).toBeGreaterThanOrEqual(80)
  })

  it('pairs multiple transfers on different dates', () => {
    const stmtA = makeStmt('checking', [
      makeTxn({ id: 'w1', date: '2025-02-02', amount: 500, description: 'Withdrawal Home Banking Transfer To Share 0000' }),
      makeTxn({ id: 'w2', date: '2025-02-03', amount: 1500, description: 'Withdrawal Home Banking Transfer To Share 0000' }),
      makeTxn({ id: 'w3', date: '2025-02-08', amount: 1100, description: 'Withdrawal Home Banking Transfer To Share 0090' }),
    ])
    const stmtB = makeStmt('savings', [
      makeTxn({ id: 'd1', date: '2025-02-02', amount: -500, description: 'Deposit Home Banking Transfer From Share 0090' }),
      makeTxn({ id: 'd2', date: '2025-02-03', amount: -1500, description: 'Deposit Home Banking Transfer From Share 0090' }),
      makeTxn({ id: 'd3', date: '2025-02-08', amount: -1100, description: 'Deposit Home Banking Transfer From Share 0000' }),
    ])

    const pairs = detectTransferPairs([stmtA, stmtB])
    expect(pairs).toHaveLength(3)

    const pairIds = pairs.map(p => [p.txnA.transactionId, p.txnB.transactionId].sort())
    expect(pairIds).toContainEqual(['d1', 'w1'])
    expect(pairIds).toContainEqual(['d2', 'w2'])
    expect(pairIds).toContainEqual(['d3', 'w3'])
  })

  it('handles cross-day transfers within 2-day window', () => {
    const stmtA = makeStmt('bank_a', [
      makeTxn({ id: 'w1', date: '2025-01-31', amount: 2000, description: 'ACH Transfer withdrawal' }),
    ])
    const stmtB = makeStmt('bank_b', [
      makeTxn({ id: 'd1', date: '2025-02-01', amount: -2000, description: 'ACH Transfer deposit' }),
    ])

    const pairs = detectTransferPairs([stmtA, stmtB])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].dayDiff).toBe(1)
  })

  it('does not pair transactions beyond maxDayGap', () => {
    const stmtA = makeStmt('checking', [
      makeTxn({ id: 'w1', date: '2025-02-01', amount: 500, description: 'Transfer to savings' }),
    ])
    const stmtB = makeStmt('savings', [
      makeTxn({ id: 'd1', date: '2025-02-05', amount: -500, description: 'Transfer from checking' }),
    ])

    const pairs = detectTransferPairs([stmtA, stmtB], { maxDayGap: 2 })
    expect(pairs).toHaveLength(0)
  })

  it('does not pair transactions within the same statement', () => {
    const stmt = makeStmt('checking', [
      makeTxn({ id: 'w1', date: '2025-02-08', amount: 500, description: 'Transfer to savings' }),
      makeTxn({ id: 'd1', date: '2025-02-08', amount: -500, description: 'Transfer from savings' }),
    ])

    const pairs = detectTransferPairs([stmt])
    expect(pairs).toHaveLength(0)
  })

  it('does not pair transactions with same sign', () => {
    const stmtA = makeStmt('checking', [
      makeTxn({ id: 'w1', date: '2025-02-08', amount: 500, description: 'Transfer to savings' }),
    ])
    const stmtB = makeStmt('savings', [
      makeTxn({ id: 'w2', date: '2025-02-08', amount: 500, description: 'Transfer to other' }),
    ])

    const pairs = detectTransferPairs([stmtA, stmtB])
    expect(pairs).toHaveLength(0)
  })

  it('does not create false positives for unrelated same-amount transactions', () => {
    const stmtA = makeStmt('checking', [
      makeTxn({ id: 'g1', date: '2025-02-08', amount: 50, description: 'Walmart Groceries', category: 'groceries_general' }),
    ])
    const stmtB = makeStmt('credit_card', [
      makeTxn({ id: 'g2', date: '2025-02-08', amount: -50, description: 'Amazon Refund', category: 'shopping_online' }),
    ])

    const pairs = detectTransferPairs([stmtA, stmtB])
    expect(pairs).toHaveLength(0)
  })

  it('prefers same-institution pairs over cross-institution', () => {
    const stmtA = makeStmt('cu_checking', [
      makeTxn({ id: 'w1', date: '2025-02-08', amount: 1000, description: 'Withdrawal Home Banking Transfer To Share 0090' }),
    ], { issuer: 'My Credit Union' })
    const stmtB = makeStmt('cu_savings', [
      makeTxn({ id: 'd1', date: '2025-02-08', amount: -1000, description: 'Deposit Home Banking Transfer From Share 0000' }),
    ], { issuer: 'My Credit Union' })
    const stmtC = makeStmt('other_bank', [
      makeTxn({ id: 'd2', date: '2025-02-08', amount: -1000, description: 'ACH Transfer deposit' }),
    ], { issuer: 'Other Bank' })

    const pairs = detectTransferPairs([stmtA, stmtB, stmtC])
    expect(pairs).toHaveLength(1)
    // Should match within same institution
    expect(pairs[0].txnA.transactionId).toBe('w1')
    expect(pairs[0].txnB.transactionId).toBe('d1')
  })

  it('each transaction can only be in one pair', () => {
    const stmtA = makeStmt('checking', [
      makeTxn({ id: 'w1', date: '2025-02-08', amount: 500, description: 'Transfer to savings' }),
    ])
    const stmtB = makeStmt('savings', [
      makeTxn({ id: 'd1', date: '2025-02-08', amount: -500, description: 'Transfer from checking' }),
      makeTxn({ id: 'd2', date: '2025-02-08', amount: -500, description: 'Transfer from checking' }),
    ])

    const pairs = detectTransferPairs([stmtA, stmtB])
    expect(pairs).toHaveLength(1)
  })

  it('returns empty array for no statements', () => {
    expect(detectTransferPairs([])).toEqual([])
    expect(detectTransferPairs([makeStmt('empty', [])])).toEqual([])
  })
})

// ── findTransferPair ──

describe('findTransferPair', () => {
  it('finds pair for a given transaction ID', () => {
    const pairs = [{
      txnA: { transactionId: 'w1', statementId: 's1' },
      txnB: { transactionId: 'd1', statementId: 's2' },
      pairId: 'xfer_pair_w1_d1',
      confidence: 80,
      dayDiff: 0,
    }]

    const resultA = findTransferPair('w1', pairs)
    expect(resultA).not.toBeNull()
    expect(resultA.counterpart.transactionId).toBe('d1')

    const resultB = findTransferPair('d1', pairs)
    expect(resultB).not.toBeNull()
    expect(resultB.counterpart.transactionId).toBe('w1')
  })

  it('returns null for non-paired transaction', () => {
    expect(findTransferPair('unknown', [])).toBeNull()
  })
})

// ── buildPairLookup ──

describe('buildPairLookup', () => {
  it('builds a map for O(1) lookup', () => {
    const pairs = [{
      txnA: { transactionId: 'w1', statementId: 's1', accountName: 'Checking' },
      txnB: { transactionId: 'd1', statementId: 's2', accountName: 'Savings' },
      pairId: 'xfer_pair_w1_d1',
      confidence: 80,
      dayDiff: 0,
    }]

    const lookup = buildPairLookup(pairs)
    expect(lookup.has('w1')).toBe(true)
    expect(lookup.has('d1')).toBe(true)
    expect(lookup.get('w1').counterpart.transactionId).toBe('d1')
    expect(lookup.get('d1').counterpart.transactionId).toBe('w1')
    expect(lookup.has('unknown')).toBe(false)
  })
})

// ── applyTransferPairs ──

describe('applyTransferPairs', () => {
  it('auto-categorizes paired transactions as transfer_general', () => {
    const stmtA = makeStmt('checking', [
      makeTxn({ id: 'w1', date: '2025-02-08', amount: 1100, description: 'Withdrawal Home Banking Transfer To Share 0090', category: 'other_general' }),
    ])
    const stmtB = makeStmt('savings', [
      makeTxn({ id: 'd1', date: '2025-02-08', amount: -1100, description: 'Deposit Home Banking Transfer From Share 0000', category: 'other_general' }),
    ])

    const { statements, pairs } = applyTransferPairs([stmtA, stmtB])
    expect(pairs).toHaveLength(1)

    const w1 = statements[0].transactions.find(t => t.id === 'w1')
    const d1 = statements[1].transactions.find(t => t.id === 'd1')
    expect(w1.category).toBe('transfer_general')
    expect(d1.category).toBe('transfer_general')
    expect(w1.transferPairId).toBeDefined()
    expect(d1.transferPairId).toBe(w1.transferPairId)
    expect(w1.transferPairTxnId).toBe('d1')
    expect(d1.transferPairTxnId).toBe('w1')
  })

  it('does not override user-modified category', () => {
    const stmtA = makeStmt('checking', [
      makeTxn({
        id: 'w1', date: '2025-02-08', amount: 1100,
        description: 'Withdrawal Home Banking Transfer To Share 0090',
        category: 'investments_general',
        userModifiedFields: ['category'],
      }),
    ])
    const stmtB = makeStmt('savings', [
      makeTxn({ id: 'd1', date: '2025-02-08', amount: -1100, description: 'Deposit Home Banking Transfer From Share 0000', category: 'other_general' }),
    ])

    const { statements } = applyTransferPairs([stmtA, stmtB])

    const w1 = statements[0].transactions.find(t => t.id === 'w1')
    expect(w1.category).toBe('investments_general') // not overridden
    expect(w1.transferPairId).toBeDefined() // still linked

    const d1 = statements[1].transactions.find(t => t.id === 'd1')
    expect(d1.category).toBe('transfer_general') // auto-set
  })

  it('returns original statements when no pairs found', () => {
    const stmt = makeStmt('checking', [
      makeTxn({ id: 'g1', description: 'Walmart', category: 'groceries_general', amount: 50 }),
    ])

    const { statements, pairs } = applyTransferPairs([stmt])
    expect(pairs).toHaveLength(0)
    expect(statements).toStrictEqual([stmt])
  })
})
