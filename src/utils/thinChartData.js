/**
 * Downsample chart data while preserving critical event points.
 *
 * @param {Array} data - The data points array to thin.
 * @param {number} maxPoints - Maximum number of points to keep.
 * @param {(pt: object, i: number, arr: Array) => boolean} [isCritical] - Optional predicate that returns true for points that must be preserved.
 * @returns {Array} Thinned data array.
 */
export function thinChartData(data, maxPoints, isCritical) {
  if (!data || data.length <= maxPoints) return data
  const step = Math.ceil(data.length / maxPoints)
  return data.filter((pt, i, arr) =>
    i % step === 0 || i === arr.length - 1 || (isCritical && isCritical(pt, i, arr))
  )
}

/**
 * Default critical-point predicate for burndown-style charts.
 * Preserves runout months, one-time events, and benefit window transitions.
 */
export function isBurndownCritical(pt, i, arr) {
  if (pt.balance === 0 || pt.oneTimeCost || pt.oneTimeIncome) return true
  if (i > 0 && pt.inBenefitWindow !== arr[i - 1].inBenefitWindow) return true
  return false
}
