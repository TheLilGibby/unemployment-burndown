import { useState, useCallback, useRef, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import html2canvas from 'html2canvas'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''

const CATEGORIES = [
  { label: 'Bug', value: 'bug' },
  { label: 'Feature', value: 'feature' },
  { label: 'Task', value: 'task' },
]

/** Capture marker.io-style environment metadata at the moment the button is clicked */
function collectMetadata() {
  const ua = navigator.userAgent
  let browser = 'Unknown'
  if (ua.includes('Firefox/')) browser = 'Firefox ' + (ua.match(/Firefox\/([\d.]+)/)?.[1] || '')
  else if (ua.includes('Edg/')) browser = 'Edge ' + (ua.match(/Edg\/([\d.]+)/)?.[1] || '')
  else if (ua.includes('Chrome/')) browser = 'Chrome ' + (ua.match(/Chrome\/([\d.]+)/)?.[1] || '')
  else if (ua.includes('Safari/')) browser = 'Safari ' + (ua.match(/Version\/([\d.]+)/)?.[1] || '')

  let os = 'Unknown'
  if (ua.includes('Win')) os = 'Windows'
  else if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'

  return {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    browser,
    os,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screenResolution: `${screen.width}x${screen.height}`,
    devicePixelRatio: window.devicePixelRatio,
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled,
  }
}

const DRAW_COLORS = ['#ef4444', '#3b82f6', '#111827', '#facc15']

/* ─── Main widget ─────────────────────────────────────────── */

export default function BugDropWidget() {
  const { resolved } = useTheme()
  const isDark = resolved === 'dark'
  const widgetRef = useRef(null)
  const [step, setStep] = useState('idle') // idle | capturing | annotate | form
  const [screenshotUrl, setScreenshotUrl] = useState(null)
  const [annotatedUrl, setAnnotatedUrl] = useState(null)
  const [metadata, setMetadata] = useState(null)

  const handleOpen = useCallback(async () => {
    setMetadata(collectMetadata())
    setStep('capturing')
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        scale: 1,
        ignoreElements: (el) => el === widgetRef.current,
      })

      const MAX_W = 1280
      let result = canvas
      if (canvas.width > MAX_W) {
        const ratio = MAX_W / canvas.width
        const resized = document.createElement('canvas')
        resized.width = MAX_W
        resized.height = Math.round(canvas.height * ratio)
        resized.getContext('2d').drawImage(canvas, 0, 0, resized.width, resized.height)
        result = resized
      }

      setScreenshotUrl(result.toDataURL('image/jpeg', 0.7))
      setStep('annotate')
    } catch {
      // If screenshot fails, skip straight to form
      setStep('form')
    }
  }, [])

  const handleClose = useCallback(() => {
    setStep('idle')
    setScreenshotUrl(null)
    setAnnotatedUrl(null)
    setMetadata(null)
  }, [])

  return (
    <div ref={widgetRef} data-testid="feedback-widget">
      {/* Floating button */}
      <button
        onClick={step === 'idle' ? handleOpen : handleClose}
        aria-label={step === 'idle' ? 'Send feedback' : 'Close feedback'}
        data-testid="feedback-button"
        style={{
          position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 10001,
          width: '48px', height: '48px', borderRadius: '50%', border: 'none',
          background: '#14b8a6', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)', fontSize: '22px', lineHeight: 1,
        }}
      >
        {step !== 'idle' ? '\u2715' : '\uD83D\uDCAC'}
      </button>

      {/* Capturing overlay */}
      {step === 'capturing' && (
        <div data-testid="feedback-capturing" style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.3)',
        }}>
          <div style={{
            background: isDark ? '#1f2937' : '#fff', padding: '1.5rem 2rem',
            borderRadius: '12px', color: isDark ? '#f9fafb' : '#111827', fontSize: '0.9rem',
          }}>
            Capturing screenshot…
          </div>
        </div>
      )}

      {/* Annotation view */}
      {step === 'annotate' && screenshotUrl && (
        <AnnotationView
          screenshotUrl={screenshotUrl}
          isDark={isDark}
          onDone={(url) => { setAnnotatedUrl(url); setStep('form') }}
          onSkip={() => { setAnnotatedUrl(screenshotUrl); setStep('form') }}
          onClose={handleClose}
        />
      )}

      {/* Feedback form */}
      {step === 'form' && (
        <FeedbackPanel
          isDark={isDark}
          onClose={handleClose}
          screenshotUrl={annotatedUrl || screenshotUrl}
          metadata={metadata}
        />
      )}
    </div>
  )
}

/* ─── Annotation overlay ──────────────────────────────────── */

function AnnotationView({ screenshotUrl, isDark, onDone, onSkip, onClose }) {
  const canvasRef = useRef(null)
  const bgRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const historyRef = useRef([])
  const [color, setColor] = useState('#ef4444')
  const colorRef = useRef('#ef4444')

  const bg = isDark ? '#1f2937' : '#ffffff'
  const text = isDark ? '#f9fafb' : '#111827'
  const border = isDark ? '#374151' : '#d1d5db'

  useEffect(() => { colorRef.current = color }, [color])

  /* Load the screenshot into the canvas */
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      bgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return

      const maxW = Math.min(window.innerWidth - 80, 900)
      const maxH = Math.min(window.innerHeight - 180, 600)
      const r = Math.min(maxW / img.width, maxH / img.height, 1)
      canvas.width = Math.round(img.width * r)
      canvas.height = Math.round(img.height * r)

      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = screenshotUrl
  }, [screenshotUrl])

  /* Map pointer coordinates to canvas space */
  const getPos = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (cx - rect.left) * (canvas.width / rect.width),
      y: (cy - rect.top) * (canvas.height / rect.height),
    }
  }, [])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Save snapshot for undo
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    drawingRef.current = true
    lastPosRef.current = getPos(e)
    ctx.strokeStyle = colorRef.current
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [getPos])

  const onPointerMove = useCallback((e) => {
    e.preventDefault()
    if (!drawingRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPosRef.current = pos
  }, [getPos])

  const onPointerUp = useCallback((e) => {
    e.preventDefault()
    drawingRef.current = false
  }, [])

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx || historyRef.current.length === 0) return
    ctx.putImageData(historyRef.current.pop(), 0, 0)
  }, [])

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = bgRef.current
    if (!ctx || !img) return
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    historyRef.current = []
  }, [])

  const handleDone = useCallback(() => {
    onDone(canvasRef.current.toDataURL('image/jpeg', 0.7))
  }, [onDone])

  return (
    <div data-testid="annotation-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', padding: '1rem',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem',
        padding: '0.5rem 1rem', background: bg, borderRadius: '8px', border: `1px solid ${border}`,
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '0.8rem', color: text, marginRight: '0.25rem' }}>Draw:</span>
        {DRAW_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`} style={{
            width: '24px', height: '24px', borderRadius: '50%', padding: 0,
            background: c, border: color === c ? '3px solid #14b8a6' : `2px solid ${border}`,
            cursor: 'pointer',
          }} />
        ))}
        <div style={{ width: '1px', height: '20px', background: border, margin: '0 0.25rem' }} />
        <button onClick={handleUndo} data-testid="annotation-undo" style={{
          background: 'none', border: `1px solid ${border}`, borderRadius: '6px',
          padding: '0.25rem 0.5rem', cursor: 'pointer', color: text, fontSize: '0.75rem',
        }}>Undo</button>
        <button onClick={handleClear} data-testid="annotation-clear" style={{
          background: 'none', border: `1px solid ${border}`, borderRadius: '6px',
          padding: '0.25rem 0.5rem', cursor: 'pointer', color: text, fontSize: '0.75rem',
        }}>Clear</button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="annotation-canvas"
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        style={{
          borderRadius: '8px', border: `2px solid ${border}`, cursor: 'crosshair',
          maxWidth: '100%', touchAction: 'none',
        }}
      />

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button onClick={onClose} style={{
          padding: '0.5rem 1rem', borderRadius: '6px', border: `1px solid ${border}`,
          background: 'transparent', color: text, cursor: 'pointer', fontSize: '0.85rem',
        }}>Cancel</button>
        <button onClick={onSkip} data-testid="annotation-skip" style={{
          padding: '0.5rem 1rem', borderRadius: '6px', border: `1px solid ${border}`,
          background: 'transparent', color: text, cursor: 'pointer', fontSize: '0.85rem',
        }}>Skip</button>
        <button onClick={handleDone} data-testid="annotation-next" style={{
          padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
          background: '#14b8a6', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
        }}>Next</button>
      </div>
    </div>
  )
}

/* ─── Feedback form panel ─────────────────────────────────── */

function FeedbackPanel({ isDark, onClose, screenshotUrl, metadata }) {
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const bg = isDark ? '#1f2937' : '#ffffff'
  const text = isDark ? '#f9fafb' : '#111827'
  const textSecondary = isDark ? '#9ca3af' : '#4b5563'
  const border = isDark ? '#374151' : '#d1d5db'
  const inputBg = isDark ? '#111827' : '#f9fafb'

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) return

    setStatus('submitting')
    setErrorMsg('')

    try {
      const payload = {
        category: selected?.value || null,
        description: description.trim(),
      }
      if (screenshotUrl) payload.screenshot = screenshotUrl
      if (metadata) payload.metadata = metadata

      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setStatus('success')
      setDescription('')
      setSelected(null)
    } catch (err) {
      setStatus('error')
      // Give a friendlier message for network-level failures
      if (err.name === 'TypeError' && /fetch/i.test(err.message)) {
        setErrorMsg('Unable to reach the feedback server. Please check your connection or try again later.')
      } else {
        setErrorMsg(err.message || 'Something went wrong')
      }
    }
  }, [description, selected, screenshotUrl, metadata])

  return (
    <div
      data-testid="feedback-panel"
      style={{
        position: 'fixed', bottom: '5rem', right: '1.25rem', zIndex: 10000,
        width: '340px', background: bg, color: text,
        borderRadius: '12px', border: `1px solid ${border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)', padding: '1.25rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxHeight: 'calc(100vh - 7rem)', overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Send Feedback</h3>
        <button
          onClick={onClose}
          aria-label="Close feedback"
          data-testid="feedback-close"
          style={{
            background: 'none', border: 'none', color: textSecondary,
            cursor: 'pointer', fontSize: '18px', padding: '2px 6px', lineHeight: 1,
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
              width: '100%', padding: '0.5rem', borderRadius: '6px',
              border: `1px solid ${border}`, background: 'transparent',
              color: text, cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          {/* Screenshot thumbnail */}
          {screenshotUrl && (
            <div style={{ marginBottom: '0.75rem' }}>
              <img
                src={screenshotUrl}
                alt="Annotated screenshot"
                data-testid="feedback-screenshot-thumb"
                style={{
                  width: '100%', borderRadius: '6px',
                  border: `1px solid ${border}`, display: 'block',
                }}
              />
            </div>
          )}

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
                  padding: '0.35rem 0.75rem', borderRadius: '6px',
                  border: `1px solid ${selected === cat ? '#14b8a6' : border}`,
                  background: selected === cat ? '#14b8a6' : 'transparent',
                  color: selected === cat ? '#fff' : text,
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
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
              width: '100%', padding: '0.5rem', borderRadius: '6px',
              border: `1px solid ${border}`, background: inputBg, color: text,
              fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />

          {/* Error message */}
          {status === 'error' && (
            <p data-testid="feedback-error" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#f87171' }}>
              {errorMsg}
            </p>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={status === 'submitting' || !description.trim()}
            data-testid="feedback-submit"
            style={{
              marginTop: '0.75rem', width: '100%', padding: '0.5rem',
              borderRadius: '6px', border: 'none',
              background: status === 'submitting' || !description.trim() ? '#5eead4' : '#14b8a6',
              color: '#fff',
              cursor: status === 'submitting' || !description.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem', fontWeight: 600,
              opacity: status === 'submitting' ? 0.7 : 1,
            }}
          >
            {status === 'submitting' ? 'Submitting…' : 'Submit'}
          </button>
        </>
      )}
    </div>
  )
}
