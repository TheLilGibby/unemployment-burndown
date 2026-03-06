import dayjs from 'dayjs'

/**
 * Find transactions that potentially match an overview item by amount and date.
 * @param {{ amount: number, date: string }} overviewItem
 * @param {Array} transactions
 * @param {{ dayRange?: number, amountTolerancePct?: number }} opts
 * @returns {Array} sorted by match quality (best first), each with _matchScore, _dayDiff, _amountDiff
 */
export function findMatchingTransactions(overviewItem, transactions, opts = {}) {
  const { dayRange = 7, amountTolerancePct = 10 } = opts
  const itemAmount = Math.abs(Number(overviewItem.amount) || 0)
  const itemDate = dayjs(overviewItem.date)
  if (!itemDate.isValid() || itemAmount === 0) return []

  const amountLow = itemAmount * (1 - amountTolerancePct / 100)
  const amountHigh = itemAmount * (1 + amountTolerancePct / 100)

  return transactions
    .filter(txn => {
      const txnAmount = Math.abs(txn.amount || 0)
      const txnDate = dayjs(txn.date)
      if (!txnDate.isValid()) return false
      return txnAmount >= amountLow && txnAmount <= amountHigh &&
             Math.abs(txnDate.diff(itemDate, 'day')) <= dayRange
    })
    .map(txn => {
      const amountDiff = Math.abs(Math.abs(txn.amount) - itemAmount)
      const dayDiff = Math.abs(dayjs(txn.date).diff(itemDate, 'day'))
      const score = (amountDiff / (itemAmount || 1)) * 100 + dayDiff
      return { ...txn, _matchScore: score, _dayDiff: dayDiff, _amountDiff: amountDiff }
    })
    .sort((a, b) => a._matchScore - b._matchScore)
}
