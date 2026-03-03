import { useState, useRef, useEffect, useCallback } from 'react'

const TOOLS = [
  { id: 'pen', label: 'Draw', icon: '\u270F\uFE0F' },
  { id: 'highlight', label: 'Highlight', icon: '\uD83D\uDD8D\uFE0F' },
  { id: 'arrow', label: 'Arrow', icon: '\u2197\uFE0F' },
  { id: 'rect', label: 'Rectangle', icon: '\u25A1' },
  { id: 'text', label: 'Text', icon: 'T' },
]

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#000000']

/**
 * Canvas-based screenshot annotator.
 * Renders a captured screenshot and lets the user draw/highlight/arrow/rect/text on top.
 *
 * Props:
 *  - imageDataUrl: data URL of the captured screenshot
 *  - onSave(blob): called with the annotated PNG blob when user confirms
 *  - onDiscard(): called when user removes the screenshot
 *  - isDark: theme flag
 */
export default function ScreenshotAnnotator({ imageDataUrl, onSave, onDiscard, isDark }) {
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const containerRef = useRef(null)

  const [activeTool, setActiveTool] = useState('pen')
  const [activeColor, setActiveColor] = useState('#ef4444')
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState(null)
  const [textInput, setTextInput] = useState(null) // { x, y } or null
  const [history, setHistory] = useState([])       // stack of overlay ImageData snapshots
  const [imgLoaded, setImgLoaded] = useState(false)

  // Image dimensions scaled to fit container
  const [dims, setDims] = useState({ w: 0, h: 0 })

  // Load image onto base canvas
  useEffect(() => {
    if (!imageDataUrl) return
    const img = new Image()
    img.onload = () => {
      const maxW = 560
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      setDims({ w, h })

      const canvas = canvasRef.current
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      // Setup overlay canvas
      const overlay = overlayRef.current
      overlay.width = w
      overlay.height = h

      setImgLoaded(true)
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  // Save current overlay state for undo
  const pushHistory = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')
    setHistory(prev => [...prev, ctx.getImageData(0, 0, overlay.width, overlay.height)])
  }, [])

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev
      const next = [...prev]
      const last = next.pop()
      const overlay = overlayRef.current
      if (overlay) {
        const ctx = overlay.getContext('2d')
        if (next.length === 0) {
          ctx.clearRect(0, 0, overlay.width, overlay.height)
        } else {
          ctx.putImageData(last, 0, 0)
          // Actually restore the previous state
          ctx.clearRect(0, 0, overlay.width, overlay.height)
          ctx.putImageData(next[next.length - 1], 0, 0)
        }
      }
      return next
    })
  }, [])

  // Get position relative to canvas
  const getPos = useCallback((e) => {
    const rect = overlayRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  // ── Drawing handlers ──

  const handlePointerDown = useCallback((e) => {
    if (activeTool === 'text') {
      const pos = getPos(e)
      setTextInput(pos)
      return
    }
    pushHistory()
    setDrawing(true)
    setStartPos(getPos(e))

    if (activeTool === 'pen' || activeTool === 'highlight') {
      const ctx = overlayRef.current.getContext('2d')
      ctx.beginPath()
      const pos = getPos(e)
      ctx.moveTo(pos.x, pos.y)
    }
  }, [activeTool, getPos, pushHistory])

  const handlePointerMove = useCallback((e) => {
    if (!drawing) return
    const ctx = overlayRef.current.getContext('2d')
    const pos = getPos(e)

    if (activeTool === 'pen') {
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else if (activeTool === 'highlight') {
      ctx.strokeStyle = activeColor + '55' // semi-transparent
      ctx.lineWidth = 18
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }
    // arrow and rect draw on pointer up
  }, [drawing, activeTool, activeColor, getPos])

  const handlePointerUp = useCallback((e) => {
    if (!drawing) return
    setDrawing(false)
    const ctx = overlayRef.current.getContext('2d')
    const endPos = getPos(e.changedTouches ? e.changedTouches[0] : e)

    if (activeTool === 'arrow' && startPos) {
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      // Line
      ctx.beginPath()
      ctx.moveTo(startPos.x, startPos.y)
      ctx.lineTo(endPos.x, endPos.y)
      ctx.stroke()
      // Arrowhead
      const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x)
      const headLen = 14
      ctx.beginPath()
      ctx.moveTo(endPos.x, endPos.y)
      ctx.lineTo(endPos.x - headLen * Math.cos(angle - 0.4), endPos.y - headLen * Math.sin(angle - 0.4))
      ctx.moveTo(endPos.x, endPos.y)
      ctx.lineTo(endPos.x - headLen * Math.cos(angle + 0.4), endPos.y - headLen * Math.sin(angle + 0.4))
      ctx.stroke()
    } else if (activeTool === 'rect' && startPos) {
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 2.5
      ctx.strokeRect(startPos.x, startPos.y, endPos.x - startPos.x, endPos.y - startPos.y)
    }

    setStartPos(null)
  }, [drawing, activeTool, activeColor, startPos, getPos])

  // Text placement
  const commitText = useCallback((value) => {
    if (!value.trim() || !textInput) { setTextInput(null); return }
    pushHistory()
    const ctx = overlayRef.current.getContext('2d')
    ctx.font = 'bold 16px system-ui, sans-serif'
    ctx.fillStyle = activeColor
    ctx.fillText(value, textInput.x, textInput.y)
    setTextInput(null)
  }, [textInput, activeColor, pushHistory])

  // Merge canvases and export
  const exportBlob = useCallback(() => {
    return new Promise((resolve) => {
      const merged = document.createElement('canvas')
      merged.width = dims.w
      merged.height = dims.h
      const ctx = merged.getContext('2d')
      ctx.drawImage(canvasRef.current, 0, 0)
      ctx.drawImage(overlayRef.current, 0, 0)
      merged.toBlob((blob) => resolve(blob), 'image/png')
    })
  }, [dims])

  const handleSave = useCallback(async () => {
    const blob = await exportBlob()
    onSave(blob)
  }, [exportBlob, onSave])

  // Style tokens
  const bg = isDark ? '#1f2937' : '#ffffff'
  const text = isDark ? '#f9fafb' : '#111827'
  const border = isDark ? '#374151' : '#d1d5db'
  const toolbarBg = isDark ? '#111827' : '#f3f4f6'

  if (!imageDataUrl) return null

  return (
    <div style={{ marginBottom: '0.75rem' }} data-testid="screenshot-annotator">
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '0.35rem',
        padding: '0.25rem', borderRadius: '6px', background: toolbarBg,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            title={t.label}
            data-testid={`tool-${t.id}`}
            style={{
              padding: '0.2rem 0.4rem', borderRadius: '4px', border: 'none',
              background: activeTool === t.id ? '#14b8a6' : 'transparent',
              color: activeTool === t.id ? '#fff' : text,
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
            }}
          >
            {t.icon}
          </button>
        ))}

        <span style={{ width: '1px', height: '18px', background: border, margin: '0 0.2rem' }} />

        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setActiveColor(c)}
            data-testid={`color-${c}`}
            style={{
              width: '16px', height: '16px', borderRadius: '50%', border: activeColor === c ? '2px solid #14b8a6' : '1px solid ' + border,
              background: c, cursor: 'pointer', padding: 0,
            }}
          />
        ))}

        <span style={{ width: '1px', height: '18px', background: border, margin: '0 0.2rem' }} />

        <button
          onClick={undo}
          disabled={history.length === 0}
          title="Undo"
          data-testid="annotator-undo"
          style={{
            padding: '0.2rem 0.4rem', borderRadius: '4px', border: 'none',
            background: 'transparent', color: history.length ? text : border,
            cursor: history.length ? 'pointer' : 'not-allowed', fontSize: '0.8rem',
          }}
        >
          {'\u21A9'}
        </button>

        <button
          onClick={onDiscard}
          title="Remove screenshot"
          data-testid="annotator-discard"
          style={{
            marginLeft: 'auto', padding: '0.2rem 0.4rem', borderRadius: '4px', border: 'none',
            background: 'transparent', color: '#ef4444',
            cursor: 'pointer', fontSize: '0.8rem',
          }}
        >
          {'\u2715'}
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: `1px solid ${border}`, lineHeight: 0 }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
        <canvas
          ref={overlayRef}
          data-testid="annotator-canvas"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={() => { if (drawing) setDrawing(false) }}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            cursor: activeTool === 'text' ? 'text' : 'crosshair',
          }}
        />

        {/* Inline text input */}
        {textInput && (
          <input
            autoFocus
            data-testid="annotator-text-input"
            onKeyDown={e => { if (e.key === 'Enter') commitText(e.target.value) }}
            onBlur={e => commitText(e.target.value)}
            style={{
              position: 'absolute',
              left: `${(textInput.x / dims.w) * 100}%`,
              top: `${(textInput.y / dims.h) * 100}%`,
              transform: 'translateY(-100%)',
              background: 'rgba(255,255,255,0.9)',
              border: `1px solid ${activeColor}`,
              color: activeColor,
              fontSize: '14px', fontWeight: 'bold',
              padding: '2px 4px', borderRadius: '3px',
              outline: 'none', minWidth: '60px',
            }}
          />
        )}

        {!imgLoaded && (
          <div style={{ padding: '2rem', textAlign: 'center', color: text, fontSize: '0.8rem' }}>
            Loading screenshot...
          </div>
        )}
      </div>
    </div>
  )
}
