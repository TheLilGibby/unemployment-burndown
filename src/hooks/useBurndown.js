import { useMemo } from 'react'
import { computeBurndown } from '../utils/computeBurndown'

/**
 * Thin React wrapper around the pure `computeBurndown` utility.
 * Kept for backward-compatibility with existing call-sites that pass
 * positional arguments.
 */
export function useBurndown(
  savings,
  unemployment,
  expenses,
  whatIf,
  oneTimeExpenses,
  extraCash,
  investments,
  oneTimeIncome,
  monthlyIncome,
  startDate,
  jobs,
  oneTimePurchases,
  creditCards,
  healthInsurance,
  severance,
) {
  return useMemo(
    () =>
      computeBurndown({
        savings,
        unemployment,
        expenses,
        whatIf,
        oneTimeExpenses,
        extraCash,
        investments,
        oneTimeIncome,
        monthlyIncome,
        startDate,
        jobs,
        oneTimePurchases,
        creditCards,
        healthInsurance,
        severance,
      }),
    [
      savings, unemployment, expenses, whatIf,
      oneTimeExpenses, extraCash, investments,
      oneTimeIncome, monthlyIncome, startDate,
      jobs, oneTimePurchases, creditCards,
      healthInsurance, severance,
    ],
  )
}
