import { useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import { STATEMENT_CATEGORIES, getParentCategoryKey } from '../constants/categories'

/**
 * Computes budget vs. actual variance from category budgets and transactions.
 *
 * @param {Object}  categoryBudgets  - { [categoryKey]: { monthlyLimit, enabled } }
 * @param {Array}   transactions     - all transactions from statements
 * @param {Object}  transactionOverrides - { [txnId]: { category } }
 * @param {string}  [month]          - YYYY-MM to analyze (defaults to current month)
 */
export function useBudget(categoryBudgets = {}, transactions = [], transactionOverrides = {}, month) {
  const targetMonth = month || dayjs().format('YYYY-MM')

  const actualSpending = useMemo(() => {
    const spending = {}
    for (const txn of transactions) {
      if (!txn.date || txn.amount == null) continue
      const txnMonth = txn.date.slice(0, 7)
      if (txnMonth !== targetMonth) continue

      // Only count outflows (positive amounts in Plaid = money leaving account)
      const amount = Number(txn.amount) || 0
      if (amount <= 0) continue

      // Use override category if available, else transaction category
      const override = transactionOverrides[txn.id]
      const rawCategory = override?.category || txn.category
      if (!rawCategory) continue

      // Roll up to parent category
      const parentKey = getParentCategoryKey(rawCategory)
      spending[parentKey] = (spending[parentKey] || 0) + amount
    }
    return spending
  }, [transactions, transactionOverrides, targetMonth])

  const variance = useMemo(() => {
    const results = []
    for (const cat of STATEMENT_CATEGORIES) {
      const budget = categoryBudgets[cat.key]
      if (!budget?.enabled) continue

      const limit = Number(budget.monthlyLimit) || 0
      const actual = actualSpending[cat.key] || 0
      const diff = limit - actual
      const pct = limit > 0 ? (actual / limit) * 100 : 0

      results.push({
        categoryKey: cat.key,
        categoryLabel: cat.label,
        categoryColor: cat.color,
        monthlyLimit: limit,
        actual,
        diff,
        pct,
        overBudget: actual > limit,
      })
    }
    // Sort: over-budget first (highest pct), then alphabetical
    results.sort((a, b) => b.pct - a.pct)
    return results
  }, [categoryBudgets, actualSpending])

  const summary = useMemo(() => {
    if (variance.length === 0) return { totalBudget: 0, totalActual: 0, overCount: 0, underCount: 0 }
    const totalBudget = variance.reduce((s, v) => s + v.monthlyLimit, 0)
    const totalActual = variance.reduce((s, v) => s + v.actual, 0)
    const overCount = variance.filter(v => v.overBudget).length
    const underCount = variance.filter(v => !v.overBudget).length
    return { totalBudget, totalActual, overCount, underCount }
  }, [variance])

  // Available months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set()
    for (const txn of transactions) {
      if (txn.date) months.add(txn.date.slice(0, 7))
    }
    return [...months].sort().reverse()
  }, [transactions])

  const setBudget = useCallback((categoryKey, monthlyLimit, onChange) => {
    onChange(prev => ({
      ...prev,
      [categoryKey]: { monthlyLimit, enabled: true },
    }))
  }, [])

  const removeBudget = useCallback((categoryKey, onChange) => {
    onChange(prev => {
      const next = { ...prev }
      delete next[categoryKey]
      return next
    })
  }, [])

  const toggleBudget = useCallback((categoryKey, onChange) => {
    onChange(prev => ({
      ...prev,
      [categoryKey]: {
        ...prev[categoryKey],
        enabled: !prev[categoryKey]?.enabled,
      },
    }))
  }, [])

  return {
    variance,
    summary,
    actualSpending,
    availableMonths,
    targetMonth,
    setBudget,
    removeBudget,
    toggleBudget,
  }
}
