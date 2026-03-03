import { useState, useCallback, useRef } from 'react'
import { useTheme } from '../../context/ThemeContext'
import ScreenshotAnnotator from './ScreenshotAnnotator'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''

const CATEGORIES = [
  { label: 'Bug Report', value: 'bug_report' },
  { label: 'Feature Request', value: 'feature_request' },
  { label: 'Question', value: 'question' },
]

export default function BugDropWidget() {
  const { resolved } = useTheme()
  const [open, setOpen] = useState(false)
  const isDark = resolved === 'dark'

  const toggle = useCallback(() => setOpen(prev => !prev), [])

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
        {open ? '\u2715' : '\uD83D\uDCAC'}
      </button>

      {/* Feedback panel */}
      {open && (
        <FeedbackPanel
          isDark={isDark}
          onClose={toggle}
        />
      )}
    </>
  )
}

function FeedbackPanel({ isDark, onClose }) {
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('idle') // idle | submitting | capturing | success | error
  const [errorMsg, setErrorMsg] = useState('')

  // Screenshot state
  const [screenshotDataUrl, setScreenshotDataUrl] = useState(null)
  const screenshotBlobRef = useRef(null)

  const bg = isDark ? '#1f2937' : '#ffffff'
  const text = isDark ? '#f9fafb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#4b5563'
  const border = isDark ? '#374151' : '#d1d5db'
  const inputBg = isDark ? '#111827' : '#f9fafb'

  // ── Screenshot capture ──
  const captureScreenshot = useCallback(async () => {
    setStatus('capturing')
    try {
      // Dynamically import html2canvas to avoid bundling it when unused
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(document.body, {
        ignoreElements: (el) => {
          // Exclude the feedback widget itself from the capture
          return el.closest?.('[data-testid="feedback-panel"]') ||
                 el.closest?.('[data-testid="feedback-button"]') ||
                 el === el.ownerDocument?.querySelector('[data-testid="feedback-button"]')
        },
        useCORS: true,
        logging: false,
        scale: window.devicePixelRatio || 1,
      })
      setScreenshotDataUrl(canvas.toDataURL('image/png'))
      setStatus('idle')
    } catch {
      setStatus('error')
      setErrorMsg('Failed to capture screenshot')
    }
  }, [])

  const discardScreenshot = useCallback(() => {
    setScreenshotDataUrl(null)
    screenshotBlobRef.current = null
  }, [])

  const handleAnnotationSave = useCallback((blob) => {
    screenshotBlobRef.current = blob
  }, [])

  // ── Upload screenshot to S3 ──
  async function uploadScreenshot() {
    if (!screenshotBlobRef.current && !screenshotDataUrl) return null

    // If the user hasn't drawn anything, convert the raw data URL to a blob
    let blob = screenshotBlobRef.current
    if (!blob && screenshotDataUrl) {
      const resp = await fetch(screenshotDataUrl)
      blob = await resp.blob()
    }

    const formData = new FormData()
    formData.append('screenshot', blob, 'screenshot.png')

    const res = await fetch(`${API_BASE}/api/feedback/screenshot`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to upload screenshot')
    }

    const data = await res.json()
    return data.url
  }

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!description.trim()) return

    setStatus('submitting')
    setErrorMsg('')

    try {
      // Upload screenshot first if present
      let screenshotUrl = null
      if (screenshotDataUrl) {
        screenshotUrl = await uploadScreenshot()
      }

      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selected?.value || null,
          description: description.trim(),
          screenshotUrl,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setStatus('success')
      setDescription('')
      setSelected(null)
      setScreenshotDataUrl(null)
      screenshotBlobRef.current = null
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message || 'Something went wrong')
    }
  }, [description, selected, screenshotDataUrl])

  const hasScreenshot = !!screenshotDataUrl

  return (
    <div
      data-testid="feedback-panel"
      style={{
        position: 'fixed',
        bottom: '5rem',
        right: '1.25rem',
        zIndex: 9999,
        width: hasScreenshot ? '600px' : '320px',
        maxHeight: 'calc(100vh - 7rem)',
        overflowY: 'auto',
        background: bg,
        color: text,
        borderRadius: '12px',
        border: `1px solid ${border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        padding: '1.25rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        transition: 'width 0.2s ease',
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
          {'\u2715'}
        </button>
      </div>

      {status === 'success' ? (
        <div data-testid="feedback-success">
          <p style={{ margin: '1rem 0', fontSize: '0.9rem', textAlign: 'center', color: '#14b8a6' }}>
            Thanks! Your feedback has been submitted.
          </p>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '6px',
              border: `1px solid ${border}`,
              background: 'transparent',
              color: text,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: textSecondary }}>
            Choose a category and describe the issue:
          </p>

          {/* Category buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelected(cat)}
                data-testid={`feedback-cat-${cat.value}`}
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

          {/* Screenshot annotator (shown when screenshot is captured) */}
          {screenshotDataUrl && (
            <ScreenshotAnnotator
              imageDataUrl={screenshotDataUrl}
              onSave={handleAnnotationSave}
              onDiscard={discardScreenshot}
              isDark={isDark}
            />
          )}

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

          {/* Error message */}
          {status === 'error' && (
            <p data-testid="feedback-error" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#f87171' }}>
              {errorMsg}
            </p>
          )}

          {/* Action bar: screenshot + submit */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            {/* Capture screenshot button */}
            {!screenshotDataUrl && (
              <button
                onClick={captureScreenshot}
                disabled={status === 'submitting' || status === 'capturing'}
                data-testid="feedback-screenshot"
                title="Capture screenshot"
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: `1px solid ${border}`,
                  background: 'transparent',
                  color: text,
                  cursor: status === 'capturing' ? 'wait' : 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {status === 'capturing' ? '\u23F3' : '\uD83D\uDCF7'} {status === 'capturing' ? 'Capturing...' : 'Screenshot'}
              </button>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={status === 'submitting' || status === 'capturing' || !description.trim()}
              data-testid="feedback-submit"
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '6px',
                border: 'none',
                background: status === 'submitting' || !description.trim() ? '#5eead4' : '#14b8a6',
                color: '#fff',
                cursor: status === 'submitting' || !description.trim() ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: status === 'submitting' ? 0.7 : 1,
              }}
            >
              {status === 'submitting' ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
