/**
 * Validates data coming from Plaid/SnapTrade sync before applying to app state.
 * Rejects malformed arrays and sanitizes individual items so corrupt server
 * responses cannot silently break burndown calculations.
 */

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function toFiniteNumber(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function validateSavingsAccount(item) {
  if (!item || typeof item !== 'object') return null
  if (item.id == null) return null
  if (typeof item.name !== 'string' || !item.name.trim()) return null
  return {
    ...item,
    amount: toFiniteNumber(item.amount),
    active: typeof item.active === 'boolean' ? item.active : true,
  }
}

function validateCreditCard(item) {
  if (!item || typeof item !== 'object') return null
  if (item.id == null) return null
  if (typeof item.name !== 'string' || !item.name.trim()) return null
  return {
    ...item,
    balance: toFiniteNumber(item.balance),
    minimumPayment: toFiniteNumber(item.minimumPayment),
    creditLimit: toFiniteNumber(item.creditLimit),
    apr: toFiniteNumber(item.apr),
  }
}

function validateInvestment(item) {
  if (!item || typeof item !== 'object') return null
  if (item.id == null) return null
  if (typeof item.name !== 'string' || !item.name.trim()) return null
  return {
    ...item,
    monthlyAmount: toFiniteNumber(item.monthlyAmount),
    active: typeof item.active === 'boolean' ? item.active : true,
  }
}

/**
 * Validate and sanitize the three sync-relevant arrays from server data.
 * Returns an object with only the valid, sanitized arrays that should be applied.
 * Arrays that fail validation (not an array, or all items invalid) are omitted.
 */
export function validateSyncState(state) {
  if (!state || typeof state !== 'object') return null

  const result = {}

  if (state.savingsAccounts !== undefined) {
    if (Array.isArray(state.savingsAccounts)) {
      const valid = state.savingsAccounts.map(validateSavingsAccount).filter(Boolean)
      if (valid.length > 0) result.savingsAccounts = valid
    }
  }

  if (state.creditCards !== undefined) {
    if (Array.isArray(state.creditCards)) {
      const valid = state.creditCards.map(validateCreditCard).filter(Boolean)
      // creditCards can legitimately be empty (user paid everything off)
      result.creditCards = valid
    }
  }

  if (state.investments !== undefined) {
    if (Array.isArray(state.investments)) {
      const valid = state.investments.map(validateInvestment).filter(Boolean)
      // investments can legitimately be empty
      result.investments = valid
    }
  }

  return Object.keys(result).length > 0 ? result : null
}
