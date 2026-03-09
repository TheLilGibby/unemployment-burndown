export function formatCurrency(n) {
  if (n == null || isNaN(n)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatDate(d) {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatMonths(months) {
  if (months == null || months <= 0) return '0 months'
  const years = Math.floor(months / 12)
  const rem = Math.round(months % 12)
  if (years === 0) return `${rem} month${rem !== 1 ? 's' : ''}`
  if (rem === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} yr ${rem} mo`
}

/**
 * Compact dollar formatter for chart Y-axis tick labels.
 * Handles negative values correctly: -$5k instead of $-5k.
 */
export function formatAxisValue(v) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(1) + 'M'
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(0) + 'k'
  return sign + '$' + abs
}

export function formatDays(days) {
  if (days == null || days <= 0) return '0 days'
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  return `~${months} month${months !== 1 ? 's' : ''}`
}
