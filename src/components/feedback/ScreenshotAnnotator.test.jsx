import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../test/test-utils'
import ScreenshotAnnotator from './ScreenshotAnnotator'

// 1x1 red pixel PNG as a data URL for testing
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

describe('ScreenshotAnnotator', () => {
  let onSave, onDiscard

  beforeEach(() => {
    onSave = vi.fn()
    onDiscard = vi.fn()
    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
    }))
  })

  it('returns null when no imageDataUrl is provided', () => {
    const { container } = render(
      <ScreenshotAnnotator
        imageDataUrl={null}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders the annotator when imageDataUrl is provided', () => {
    render(
      <ScreenshotAnnotator
        imageDataUrl={TINY_PNG}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    expect(screen.getByTestId('screenshot-annotator')).toBeTruthy()
  })

  it('renders all drawing tools', () => {
    render(
      <ScreenshotAnnotator
        imageDataUrl={TINY_PNG}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    expect(screen.getByTestId('tool-pen')).toBeTruthy()
    expect(screen.getByTestId('tool-highlight')).toBeTruthy()
    expect(screen.getByTestId('tool-arrow')).toBeTruthy()
    expect(screen.getByTestId('tool-rect')).toBeTruthy()
    expect(screen.getByTestId('tool-text')).toBeTruthy()
  })

  it('renders color swatches', () => {
    render(
      <ScreenshotAnnotator
        imageDataUrl={TINY_PNG}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    expect(screen.getByTestId('color-#ef4444')).toBeTruthy()
    expect(screen.getByTestId('color-#3b82f6')).toBeTruthy()
  })

  it('renders undo and discard buttons', () => {
    render(
      <ScreenshotAnnotator
        imageDataUrl={TINY_PNG}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    expect(screen.getByTestId('annotator-undo')).toBeTruthy()
    expect(screen.getByTestId('annotator-discard')).toBeTruthy()
  })

  it('calls onDiscard when discard button is clicked', () => {
    render(
      <ScreenshotAnnotator
        imageDataUrl={TINY_PNG}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    fireEvent.click(screen.getByTestId('annotator-discard'))
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it('switches active tool on click', () => {
    render(
      <ScreenshotAnnotator
        imageDataUrl={TINY_PNG}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    const arrowTool = screen.getByTestId('tool-arrow')
    fireEvent.click(arrowTool)
    // Arrow tool should now be highlighted (background = #14b8a6)
    expect(arrowTool.style.background).toBe('rgb(20, 184, 166)')
  })

  it('shows text input when text tool is selected and canvas is clicked', () => {
    render(
      <ScreenshotAnnotator
        imageDataUrl={TINY_PNG}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    // Select text tool
    fireEvent.click(screen.getByTestId('tool-text'))
    // Click on the overlay canvas
    const canvas = screen.getByTestId('annotator-canvas')
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 })

    expect(screen.getByTestId('annotator-text-input')).toBeTruthy()
  })

  it('undo button is disabled when history is empty', () => {
    render(
      <ScreenshotAnnotator
        imageDataUrl={TINY_PNG}
        onSave={onSave}
        onDiscard={onDiscard}
        isDark={false}
      />
    )
    const undo = screen.getByTestId('annotator-undo')
    expect(undo.disabled).toBe(true)
  })
})
