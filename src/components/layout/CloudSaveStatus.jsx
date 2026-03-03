import { useState, useEffect } from 'react'

function CloudIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  )
}

function CloudCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
      <path d="M9 14l2 2 4-4" strokeWidth="2" />
    </svg>
  )
}

function CloudSpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
      <g style={{ transformOrigin: '13px 15px', animation: 'spin 0.8s linear infinite' }}>
        <path d="M13 11v4" strokeWidth="2" strokeOpacity="0.4" />
        <path d="M13 11a4 4 0 010 4" strokeWidth="2" />
      </g>
    </svg>
  )
}

function CloudErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
      <path d="M13 13v2" strokeWidth="2" />
      <circle cx="13" cy="17" r="0.5" fill="currentColor" />
    </svg>
  )
}

function relativeTime(date) {
  if (!date) return null
  const sec = Math.floor((Date.now() - date) / 1000)
  if (sec < 5)  return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  return `${Math.floor(min / 60)}h ago`
}

export default function CloudSaveStatus({ storage }) {
  const { status, lastSaved, errorMsg } = storage

  // Refresh relative-time display every 10 s
  const [, tick] = useState(0)
  useEffect(() => {
    if (status !== 'connected') return
    const id = setInterval(() => tick(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [status])

  const iconColor = status === 'error' ? '#f87171'
    : (status === 'saving' || status === 'connected') ? '#34d399'
    : 'var(--text-muted)'

  const title = status === 'loading' ? 'Loading…'
    : status === 'saving' ? 'Saving…'
    : status === 'error' ? (errorMsg || 'Cloud save failed')
    : lastSaved ? `Saved ${relativeTime(lastSaved)}` : 'Connected to cloud'

  const icon = status === 'loading' || status === 'saving' ? <CloudSpinnerIcon />
    : status === 'error' ? <CloudErrorIcon />
    : lastSaved ? <CloudCheckIcon /> : <CloudIcon />

  return (
    <span
      className="w-8 h-8 flex items-center justify-center rounded-lg"
      title={title}
      style={{ color: iconColor }}
    >
      {icon}
    </span>
  )
}
