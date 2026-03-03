import { useState, useCallback } from 'react'
import { useTheme } from '../../context/ThemeContext'

const REPO = 'RAG-Consulting-LLC/unemployment-burndown'
const NEW_ISSUE_URL = `https://github.com/${REPO}/issues/new`

const CATEGORIES = [
  { label: 'Bug Report', template: 'bug_report' },
  { label: 'Feature Request', template: 'feature_request' },
  { label: 'Question', template: 'question' },
]

function buildIssueUrl(category, description) {
  const params = new URLSearchParams()
  if (category) params.set('template', category.template)
  if (description) params.set('body', description)
  const qs = params.toString()
  return qs ? `${NEW_ISSUE_URL}?${qs}` : NEW_ISSUE_URL
}

export default function BugDropWidget() {
  const { resolved } = useTheme()
  const [open, setOpen] = useState(false)
  const isDark = resolved === 'dark'

  const toggle = useCallback(() => setOpen(prev => !prev), [])

  const handleSubmit = useCallback((category, description) => {
    const url = buildIssueUrl(category, description)
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }, [])

  return (
    <>
      {/* Floating feedback button */}
      <button
        onClick={toggle}
        aria-label="Send feedback"
        data-testid="feedback-button"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          right: '1.25rem',
          zIndex: 9999,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: 'none',
          background: '#14b8a6',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          fontSize: '22px',
          lineHeight: 1,
        }}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Feedback panel */}
      {open && (
        <FeedbackPanel
          isDark={isDark}
          onSubmit={handleSubmit}
          onClose={toggle}
        />
      )}
    </>
  )
}

function FeedbackPanel({ isDark, onSubmit, onClose }) {
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState(null)

  const bg = isDark ? '#1f2937' : '#ffffff'
  const text = isDark ? '#f9fafb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#4b5563'
  const border = isDark ? '#374151' : '#d1d5db'
  const inputBg = isDark ? '#111827' : '#f9fafb'

  return (
    <div
      data-testid="feedback-panel"
      style={{
        position: 'fixed',
        bottom: '5rem',
        right: '1.25rem',
        zIndex: 9999,
        width: '320px',
        background: bg,
        color: text,
        borderRadius: '12px',
        border: `1px solid ${border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        padding: '1.25rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Send Feedback</h3>
        <button
          onClick={onClose}
          aria-label="Close feedback"
          data-testid="feedback-close"
          style={{
            background: 'none',
            border: 'none',
            color: textSecondary,
            cursor: 'pointer',
            fontSize: '18px',
            padding: '2px 6px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: textSecondary }}>
        Choose a category and describe the issue:
      </p>

      {/* Category buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.template}
            onClick={() => setSelected(cat)}
            data-testid={`feedback-cat-${cat.template}`}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: `1px solid ${selected === cat ? '#14b8a6' : border}`,
              background: selected === cat ? '#14b8a6' : 'transparent',
              color: selected === cat ? '#fff' : text,
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Description textarea */}
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Describe your feedback..."
        data-testid="feedback-description"
        rows={4}
        style={{
          width: '100%',
          padding: '0.5rem',
          borderRadius: '6px',
          border: `1px solid ${border}`,
          background: inputBg,
          color: text,
          fontSize: '0.85rem',
          resize: 'vertical',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      {/* Submit */}
      <button
        onClick={() => onSubmit(selected, description)}
        data-testid="feedback-submit"
        style={{
          marginTop: '0.75rem',
          width: '100%',
          padding: '0.5rem',
          borderRadius: '6px',
          border: 'none',
          background: '#14b8a6',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        Open on GitHub
      </button>
    </div>
  )
}
