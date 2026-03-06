import { formatDate, formatMonths, formatCurrency } from '../../utils/formatters'

export default function RunwayBanner({ runoutDate, totalRunwayMonths, currentNetBurn, savings }) {
  const months = totalRunwayMonths

  let accentColor, accentBorder, dotColor, label
  if (months === null) {
    accentColor = 'text-emerald-400'
    accentBorder = 'border-emerald-500'
    dotColor = 'bg-emerald-400'
    label = 'No runout in projection window (10 yrs)'
  } else if (months > 6) {
    accentColor = 'text-emerald-400'
    accentBorder = 'border-emerald-500'
    dotColor = 'bg-emerald-400'
    label = null
  } else if (months > 3) {
    accentColor = 'text-amber-400'
    accentBorder = 'border-amber-500'
    dotColor = 'bg-amber-400'
    label = null
  } else {
    accentColor = 'text-red-400'
    accentBorder = 'border-red-500'
    dotColor = 'bg-red-400'
    label = null
  }

  return (
    <div className="theme-card rounded-xl border p-5">
      {/* Top row: label + status dot */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Estimated Runway
        </h2>
      </div>

      {/* Main content */}
      {label ? (
        <p className={`text-2xl font-bold ${accentColor} mb-5`}>{label}</p>
      ) : (
        <div className="mb-5">
          <p className={`text-3xl sm:text-4xl font-bold ${accentColor} leading-tight`}>
            {formatDate(runoutDate)}
          </p>
          <p className="text-sm mt-1 sensitive" style={{ color: 'var(--text-muted)' }}>
            {formatMonths(months)} of runway remaining
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className={`flex gap-6 sm:gap-10 pt-4 border-t`} style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Balance
          </p>
          <p className="text-xl font-semibold sensitive" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(savings)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Net Burn / Mo
          </p>
          <p className={`text-xl font-semibold sensitive ${currentNetBurn > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {currentNetBurn > 0 ? '-' : '+'}{formatCurrency(Math.abs(currentNetBurn))}
          </p>
        </div>
      </div>
    </div>
  )
}
