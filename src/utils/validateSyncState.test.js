import { describe, it, expect } from 'vitest'
import { validateSyncState } from './validateSyncState'

describe('validateSyncState', () => {
  it('returns null for falsy input', () => {
    expect(validateSyncState(null)).toBe(null)
    expect(validateSyncState(undefined)).toBe(null)
    expect(validateSyncState(0)).toBe(null)
  })

  it('returns null when no valid arrays are present', () => {
    expect(validateSyncState({})).toBe(null)
    expect(validateSyncState({ savingsAccounts: 'not-an-array' })).toBe(null)
    expect(validateSyncState({ savingsAccounts: 42 })).toBe(null)
  })

  describe('savingsAccounts', () => {
    it('passes valid accounts through', () => {
      const state = {
        savingsAccounts: [
          { id: 1, name: 'Checking', amount: 5000, active: true, assignedTo: null },
        ],
      }
      const result = validateSyncState(state)
      expect(result.savingsAccounts).toHaveLength(1)
      expect(result.savingsAccounts[0].name).toBe('Checking')
      expect(result.savingsAccounts[0].amount).toBe(5000)
    })

    it('coerces string amounts to numbers', () => {
      const state = {
        savingsAccounts: [{ id: 1, name: 'Savings', amount: '1234.56' }],
      }
      const result = validateSyncState(state)
      expect(result.savingsAccounts[0].amount).toBe(1234.56)
    })

    it('falls back to 0 for NaN amounts', () => {
      const state = {
        savingsAccounts: [{ id: 1, name: 'Savings', amount: 'corrupted' }],
      }
      const result = validateSyncState(state)
      expect(result.savingsAccounts[0].amount).toBe(0)
    })

    it('rejects items missing id', () => {
      const state = {
        savingsAccounts: [{ name: 'No ID', amount: 100 }],
      }
      expect(validateSyncState(state)).toBe(null)
    })

    it('rejects items with empty name', () => {
      const state = {
        savingsAccounts: [{ id: 1, name: '', amount: 100 }],
      }
      expect(validateSyncState(state)).toBe(null)
    })

    it('rejects items with non-string name', () => {
      const state = {
        savingsAccounts: [{ id: 1, name: 123, amount: 100 }],
      }
      expect(validateSyncState(state)).toBe(null)
    })

    it('filters out invalid items and keeps valid ones', () => {
      const state = {
        savingsAccounts: [
          { id: 1, name: 'Good', amount: 500 },
          { name: 'No ID' },
          { id: 3, name: 'Also good', amount: 1000 },
        ],
      }
      const result = validateSyncState(state)
      expect(result.savingsAccounts).toHaveLength(2)
      expect(result.savingsAccounts[0].id).toBe(1)
      expect(result.savingsAccounts[1].id).toBe(3)
    })

    it('defaults active to true if not boolean', () => {
      const state = {
        savingsAccounts: [{ id: 1, name: 'Test', amount: 100, active: 'yes' }],
      }
      const result = validateSyncState(state)
      expect(result.savingsAccounts[0].active).toBe(true)
    })

    it('preserves Plaid metadata fields', () => {
      const state = {
        savingsAccounts: [
          { id: 1, name: 'Plaid Account', amount: 200, plaidAccountId: 'abc123', plaidLastSync: '2026-01-01' },
        ],
      }
      const result = validateSyncState(state)
      expect(result.savingsAccounts[0].plaidAccountId).toBe('abc123')
      expect(result.savingsAccounts[0].plaidLastSync).toBe('2026-01-01')
    })
  })

  describe('creditCards', () => {
    it('passes valid cards through', () => {
      const state = {
        creditCards: [
          { id: 1, name: 'Chase', balance: 1500, minimumPayment: 35, creditLimit: 10000, apr: 18.5 },
        ],
      }
      const result = validateSyncState(state)
      expect(result.creditCards).toHaveLength(1)
      expect(result.creditCards[0].balance).toBe(1500)
      expect(result.creditCards[0].apr).toBe(18.5)
    })

    it('coerces string balances to numbers', () => {
      const state = {
        creditCards: [{ id: 1, name: 'Card', balance: '500.25', minimumPayment: '25', creditLimit: '5000', apr: '19.99' }],
      }
      const result = validateSyncState(state)
      expect(result.creditCards[0].balance).toBe(500.25)
      expect(result.creditCards[0].creditLimit).toBe(5000)
      expect(result.creditCards[0].apr).toBe(19.99)
    })

    it('falls back to 0 for corrupted numeric fields', () => {
      const state = {
        creditCards: [{ id: 1, name: 'Card', balance: NaN, minimumPayment: Infinity, creditLimit: undefined, apr: null }],
      }
      const result = validateSyncState(state)
      expect(result.creditCards[0].balance).toBe(0)
      expect(result.creditCards[0].minimumPayment).toBe(0)
      expect(result.creditCards[0].creditLimit).toBe(0)
      expect(result.creditCards[0].apr).toBe(0)
    })

    it('allows an empty array (all cards paid off)', () => {
      const result = validateSyncState({ creditCards: [] })
      expect(result.creditCards).toEqual([])
    })

    it('rejects non-array creditCards', () => {
      expect(validateSyncState({ creditCards: { balance: 100 } })).toBe(null)
    })
  })

  describe('investments', () => {
    it('passes valid investments through', () => {
      const state = {
        investments: [
          { id: 1, name: '401k', monthlyAmount: 500, active: true },
        ],
      }
      const result = validateSyncState(state)
      expect(result.investments).toHaveLength(1)
      expect(result.investments[0].monthlyAmount).toBe(500)
    })

    it('coerces string amounts to numbers', () => {
      const state = {
        investments: [{ id: 1, name: 'IRA', monthlyAmount: '250' }],
      }
      const result = validateSyncState(state)
      expect(result.investments[0].monthlyAmount).toBe(250)
    })

    it('allows an empty array', () => {
      const result = validateSyncState({ investments: [] })
      expect(result.investments).toEqual([])
    })
  })

  describe('mixed state', () => {
    it('returns only valid fields from mixed input', () => {
      const state = {
        savingsAccounts: [{ id: 1, name: 'Good', amount: 100 }],
        creditCards: 'invalid',
        investments: [{ id: 2, name: 'IRA', monthlyAmount: 300 }],
      }
      const result = validateSyncState(state)
      expect(result.savingsAccounts).toHaveLength(1)
      expect(result.creditCards).toBeUndefined()
      expect(result.investments).toHaveLength(1)
    })

    it('returns null if all arrays are invalid', () => {
      const state = {
        savingsAccounts: 'bad',
        creditCards: 42,
        investments: null,
      }
      expect(validateSyncState(state)).toBe(null)
    })
  })
})
