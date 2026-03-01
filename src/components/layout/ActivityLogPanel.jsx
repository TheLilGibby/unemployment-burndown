import { useEffect, useMemo, useRef, useState } from 'react'

// ── Relative time ─────────────────────────────────────────────────────────────
function relTime(date) {
  const sec = Math.floor((Date.now() - date) / 1000)
  if (sec < 5)  return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `${hr}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function SaveIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12.5 6.5a3.5 3.5 0 00-6.9-.8A2.5 2.5 0 104.5 11h8a2.5 2.5 0 000-5" />
      <path d="M8 11V7m-2 2l2-2 2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function LoadIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12.5 6.5a3.5 3.5 0 00-6.9-.8A2.5 2.5 0 104.5 11h8a2.5 2.5 0 000-5" />
      <path d="M8 7v4m-2-2l2 2 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 2l3 3-8 8H3v-3l8-8z" strokeLinejoin="round" />
    </svg>
  )
}
function ChevronIcon({ open }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
    >
      <path d="M3 2l4 3-4 3" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
    </svg>
  )
}
function TypeIcon({ type }) {
  if (type === 'save') return <SaveIcon />
  if (type === 'load') return <LoadIcon />
  return <EditIcon />
}

// ── Colours ───────────────────────────────────────────────────────────────────
function typeColor(type) {
  if (type === 'save') return 'var(--accent-emerald)'
  if (type === 'load') return 'var(--accent-blue)'
  return 'var(--text-muted)'
}
const ADD_COLOR     = 'var(--accent-emerald)'
const REMOVE_COLOR  = 'var(--accent-red)'
const CHANGE_COLOR  = 'var(--accent-amber, #fbbf24)'

// ── Detail row ────────────────────────────────────────────────────────────────
function DetailRow({ d }) {
  return (
    <div className="flex items-baseline gap-1.5 py-[3px] text-xs leading-snug">
      {/* Type badge */}
      {d.type === 'added'   && <span style={{ color: ADD_COLOR,    fontWeight: 600, flexShrink: 0 }}>+</span>}
      {d.type === 'removed' && <span style={{ color: REMOVE_COLOR, fontWeight: 600, flexShrink: 0 }}>−</span>}
      {d.type === 'changed' && <span style={{ color: CHANGE_COLOR, fontWeight: 600, flexShrink: 0 }}>↔</span>}

      {/* Item name + optional field */}
      <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--text-secondary)' }}>
        {d.name}{d.field ? <span style={{ color: 'var(--text-muted)' }}> · {d.field}</span> : null}
      </span>

      {/* Values */}
      {d.type === 'added' && d.to && (
        <span style={{ color: ADD_COLOR, flexShrink: 0 }}>{d.to}</span>
      )}
      {d.type === 'removed' && d.from && (
        <span style={{ color: REMOVE_COLOR, textDecoration: 'line-through', flexShrink: 0 }}>{d.from}</span>
      )}
      {d.type === 'changed' && (
        <span className="flex items-center gap-1 flex-shrink-0 tabular-nums">
          <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{d.from}</span>
          <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>→</span>
          <span style={{ color: ADD_COLOR, fontWeight: 500 }}>{d.to}</span>
        </span>
      )}
    </div>
  )
}

// ── Entry row (with optional expand) ─────────────────────────────────────────
function EntryRow({ entry, expanded, onToggle }) {
  const details   = entry.diff?.details || []
  const hasDetail = details.length > 0
  const hasSummary = entry.diff && entry.diff.before != null && entry.diff.after != null
    && entry.diff.before !== entry.diff.after

  return (
    <div>
      {/* Main row */}
      <div
        className="flex items-start gap-2 py-1.5 rounded"
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
        onClick={hasDetail ? onToggle : undefined}
        title={hasDetail ? (expanded ? 'Collapse details' : 'Expand to see changes') : undefined}
      >
        {/* Expand chevron — only when there are details */}
        <span
          className="mt-0.5 flex-shrink-0"
          style={{
            color: hasDetail ? 'var(--text-muted)' : 'transparent',
            width: 12,
          }}
        >
          {hasDetail && <ChevronIcon open={expanded} />}
        </span>

        {/* Type icon */}
        <span className="mt-0.5 flex-shrink-0 opacity-80" style={{ color: typeColor(entry.type) }}>
          <TypeIcon type={entry.type} />
        </span>

        {/* Message + summary diff */}
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-snug" style={{ color: 'var(--text-primary)' }}>
            {entry.message}
          </p>

          {/* Inline summary: before → after */}
          {hasSummary && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <span
                className="text-xs tabular-nums"
                style={{ color: 'var(--text-muted)', textDecoration: 'line-through', opacity: 0.7 }}
              >
                {entry.diff.before}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>→</span>
              <span
                className="text-xs font-medium tabular-nums"
                style={{ color: 'var(--accent-emerald)' }}
              >
                {entry.diff.after}
              </span>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {entry.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      {/* Expanded detail block */}
      {expanded && hasDetail && (
        <div
          className="ml-6 mb-2 px-3 py-2 rounded-lg"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {details.map((d, i) => <DetailRow key={i} d={d} />)}
        </div>
      )}
    </div>
  )
}

// ── Filter pill ───────────────────────────────────────────────────────────────
function FilterPill({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: `1px solid ${active ? color : 'var(--border-subtle)'}`,
        color: active ? color : 'var(--text-muted)',
        background: 'transparent',
        opacity: active ? 1 : 0.5,
      }}
    >
      {children}
    </button>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function ActivityLogPanel({ entries, onClose, onClear, userName, onSetUserName }) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState(userName)
  const [expanded, setExpanded]       = useState(new Set())   // Set of expanded entry IDs

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [showSaves,   setShowSaves]   = useState(false)
  const [showLoads,   setShowLoads]   = useState(false)
  const [showEdits,   setShowEdits]   = useState(true)
  const [hideAutoSave, setHideAutoSave] = useState(true)      // default: hide noisy auto-saves

  const nameRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Focus name input when editing
  useEffect(() => {
    if (editingName) nameRef.current?.select()
  }, [editingName])

  function commitName() { onSetUserName(nameInput); setEditingName(false) }
  function handleNameKey(e) {
    if (e.key === 'Enter')  commitName()
    if (e.key === 'Escape') { setNameInput(userName); setEditingName(false) }
  }

  function toggleEntry(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Apply filters
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.type === 'save') {
        if (!showSaves) return false
        if (hideAutoSave && e.message.startsWith('Auto-saved')) return false
      }
      if (e.type === 'load'   && !showLoads) return false
      if (e.type === 'change' && !showEdits) return false
      return true
    })
  }, [entries, showSaves, showLoads, showEdits, hideAutoSave])

  const filtersActive = !showSaves || !showLoads || !showEdits || hideAutoSave

  // Group filtered entries by calendar day
  const groups = []
  let lastDay = null
  for (const entry of filteredEntries) {
    const day = entry.timestamp.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })
    if (day !== lastDay) { groups.push({ day, items: [] }); lastDay = day }
    groups[groups.length - 1].items.push(entry)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className="fixed right-0 top-0 h-full z-[60] flex flex-col"
        style={{
          width: 'min(420px, 100vw)',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* Panel header */}
        <div
          className="flex items-start justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Activity Log
            </h2>

            {/* Editable user name */}
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tracker user:</span>
              {editingName ? (
                <input
                  ref={nameRef}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={handleNameKey}
                  className="text-xs px-1 rounded outline-none"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--accent-blue)',
                    color: 'var(--text-primary)',
                    width: 120,
                  }}
                />
              ) : (
                <button
                  onClick={() => { setNameInput(userName); setEditingName(true) }}
                  className="text-xs font-medium underline-offset-2 hover:underline"
                  style={{ color: 'var(--accent-blue)' }}
                  title="Click to edit your display name"
                >
                  {userName}
                </button>
              )}
            </div>

            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {filtersActive
                ? `${filteredEntries.length} of ${entries.length} event${entries.length !== 1 ? 's' : ''}`
                : `${entries.length} event${entries.length !== 1 ? 's' : ''}`
              } · click any row to expand
            </p>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            {entries.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs px-2 py-1 rounded"
                style={{
                  color: 'var(--text-muted)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:opacity-60 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close log"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div
          className="flex items-center gap-1.5 px-3 py-2 flex-shrink-0 flex-wrap"
          style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-input)' }}
        >
          <FilterPill active={showEdits} color="var(--text-secondary)" onClick={() => setShowEdits(v => !v)}>
            <EditIcon /> Edits
          </FilterPill>
          <FilterPill active={showSaves} color="var(--accent-emerald)" onClick={() => setShowSaves(v => !v)}>
            <SaveIcon /> Saves
          </FilterPill>
          <FilterPill active={showLoads} color="var(--accent-blue)" onClick={() => setShowLoads(v => !v)}>
            <LoadIcon /> Loads
          </FilterPill>
          {/* Separator */}
          <span style={{ color: 'var(--border-subtle)', marginLeft: 2, marginRight: 2 }}>|</span>
          <FilterPill
            active={hideAutoSave}
            color="var(--accent-amber, #fbbf24)"
            onClick={() => setHideAutoSave(v => !v)}
          >
            No auto-saves
          </FilterPill>
        </div>

        {/* Legend */}
        {entries.some(e => (e.diff?.details || []).length > 0) && (
          <div
            className="flex items-center gap-3 px-4 py-1.5 flex-shrink-0 text-xs"
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            <span><span style={{ color: ADD_COLOR, fontWeight: 700 }}>+</span> Added</span>
            <span><span style={{ color: REMOVE_COLOR, fontWeight: 700 }}>−</span> Removed</span>
            <span><span style={{ color: CHANGE_COLOR, fontWeight: 700 }}>↔</span> Changed</span>
          </div>
        )}

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-2"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.3">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeLinecap="round" />
              </svg>
              {entries.length === 0
                ? <>
                    <p className="text-sm">No activity yet</p>
                    <p className="text-xs opacity-60">Changes will appear here as you edit the tracker.</p>
                  </>
                : <>
                    <p className="text-sm">No events match filters</p>
                    <p className="text-xs opacity-60">Try toggling the filter chips above.</p>
                  </>
              }
            </div>
          ) : (
            <div className="px-3 py-3 space-y-5">
              {groups.map(({ day, items }) => (
                <div key={day}>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider mb-1 pb-1 px-1"
                    style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    {day}
                  </p>
                  <div>
                    {items.map(entry => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        expanded={expanded.has(entry.id)}
                        onToggle={() => toggleEntry(entry.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
