import { memo } from 'react'
import dayjs from 'dayjs'
import { Clock, X } from 'lucide-react'

/**
 * Compact control for selecting a historical snapshot date to compare.
 * Renders nothing when no snapshots are available yet.
 */
function SnapshotDatePicker({
  availableDates,    // string[] of 'YYYY-MM-DD'
  selectedDate,      // string | null
  onChange,          // (date: string | null) => void
  loading,           // bool — snapshot fetch in progress
}) {
  if (!availableDates || availableDates.length === 0) return null

  return (
    <div className="flex items-center gap-2 text-xs">
      <Clock size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
      <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>Compare with:</span>
      <select
        value={selectedDate || ''}
        onChange={e => onChange(e.target.value || null)}
        disabled={loading}
        className="rounded px-2 py-1 text-xs focus:outline-none"
        style={{
          background: 'var(--bg-input, var(--bg-card))',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          minWidth: 160,
        }}
      >
        <option value="">Select a past date…</option>
        {[...availableDates].reverse().map(d => (
          <option key={d} value={d}>
            {dayjs(d).format('MMM D, YYYY')}
          </option>
        ))}
      </select>
      {selectedDate && (
        <button
          onClick={() => onChange(null)}
          title="Clear historical comparison"
          className="flex items-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      )}
      {loading && (
        <span className="animate-pulse" style={{ color: 'var(--text-muted)' }}>Loading…</span>
      )}
    </div>
  )
}

export default memo(SnapshotDatePicker)
