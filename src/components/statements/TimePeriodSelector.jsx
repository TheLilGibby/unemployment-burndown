import { useState } from 'react'
import { Calendar } from 'lucide-react'

const PRESETS = [
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: 'ytd', label: 'YTD' },
  { id: '12m', label: '12M' },
  { id: 'all', label: 'All' },
]

export function getDateRange(presetId) {
  const now = new Date()
  let start, end

  switch (presetId) {
    case 'thisMonth': {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = now
      break
    }
    case 'lastMonth': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end = new Date(now.getFullYear(), now.getMonth(), 0)
      break
    }
    case '3m': {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      end = now
      break
    }
    case '6m': {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      end = now
      break
    }
    case 'ytd': {
      start = new Date(now.getFullYear(), 0, 1)
      end = now
      break
    }
    case '12m': {
      start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
      end = now
      break
    }
    case 'all':
    default:
      return { start: null, end: null }
  }

  const fmt = d => d.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end) }
}

export function getPreviousPeriodRange(presetId, customStart, customEnd) {
  if (presetId === 'all') return { start: null, end: null }

  if (presetId === 'custom') {
    if (!customStart || !customEnd) return { start: null, end: null }
    const s = new Date(customStart + 'T00:00:00')
    const e = new Date(customEnd + 'T00:00:00')
    const durationMs = e - s
    const prevEnd = new Date(s.getTime() - 86400000) // day before start
    const prevStart = new Date(prevEnd.getTime() - durationMs)
    const fmt = d => d.toISOString().slice(0, 10)
    return { start: fmt(prevStart), end: fmt(prevEnd) }
  }

  const { start, end } = getDateRange(presetId)
  if (!start) return { start: null, end: null }
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const durationMs = e - s
  const prevEnd = new Date(s.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - durationMs)
  const fmt = d => d.toISOString().slice(0, 10)
  return { start: fmt(prevStart), end: fmt(prevEnd) }
}

function formatRangeLabel(presetId, customStart, customEnd) {
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (presetId === 'custom') {
    if (!customStart && !customEnd) return 'Select a date range'
    return `${customStart ? fmt(customStart) : '...'} – ${customEnd ? fmt(customEnd) : '...'}`
  }

  const { start, end } = getDateRange(presetId)
  if (!start) return 'All time'
  const fmtShort = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmtShort(start)} – ${fmtShort(end)}`
}

export default function TimePeriodSelector({ value, onChange, customStart, customEnd, onCustomChange }) {
  const [showCustom, setShowCustom] = useState(value === 'custom')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => { onChange(p.id); setShowCustom(false) }}
            className="px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150"
            style={{
              background: value === p.id ? 'var(--accent-blue)' : 'var(--bg-subtle, rgba(255,255,255,0.06))',
              color: value === p.id ? '#fff' : 'var(--text-muted)',
              border: '1px solid',
              borderColor: value === p.id ? 'var(--accent-blue)' : 'var(--border-subtle)',
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => { onChange('custom'); setShowCustom(true) }}
          className="px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150"
          style={{
            background: value === 'custom' ? 'var(--accent-blue)' : 'var(--bg-subtle, rgba(255,255,255,0.06))',
            color: value === 'custom' ? '#fff' : 'var(--text-muted)',
            border: '1px solid',
            borderColor: value === 'custom' ? 'var(--accent-blue)' : 'var(--border-subtle)',
          }}
        >
          Custom
        </button>
      </div>

      {showCustom && value === 'custom' && (
        <div className="flex items-center gap-2 ml-5">
          <input
            type="date"
            value={customStart || ''}
            onChange={e => onCustomChange(e.target.value, customEnd)}
            className="text-xs px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
              colorScheme: 'dark',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={customEnd || ''}
            onChange={e => onCustomChange(customStart, e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
              colorScheme: 'dark',
            }}
          />
        </div>
      )}

      <p className="text-[11px] ml-5 tabular-nums" style={{ color: 'var(--text-faint, var(--text-muted))' }}>
        {formatRangeLabel(value, customStart, customEnd)}
      </p>
    </div>
  )
}
