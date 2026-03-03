import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/test-utils'
import BugDropWidget from './BugDropWidget'

/* ── Mocks ──────────────────────────────────────────────── */

// Mock html2canvas — returns a fake canvas with a data-URL
vi.mock('html2canvas', () => ({
  default: vi.fn(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 100
    return Promise.resolve(canvas)
  }),
}))

beforeAll(() => {
  // jsdom doesn't support canvas drawing — stub the methods we need
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    putImageData: vi.fn(),
    set fillStyle(_v) {},
    set strokeStyle(_v) {},
    set lineWidth(_v) {},
    set lineCap(_v) {},
    set lineJoin(_v) {},
    set font(_v) {},
    set textAlign(_v) {},
    set shadowColor(_v) {},
    set shadowBlur(_v) {},
    set shadowOffsetX(_v) {},
    set shadowOffsetY(_v) {},
  })
  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,TESTDATA')
})

describe('BugDropWidget', () => {
  let fetchSpy

  beforeEach(() => {
    if (!window.matchMedia || !window.matchMedia('').addEventListener) {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    }
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('renders the floating feedback button', () => {
    render(<BugDropWidget />)
    expect(screen.getByTestId('feedback-button')).toBeTruthy()
  })

  it('clicking the button shows the annotation overlay after capture', async () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => {
      expect(screen.getByTestId('annotation-overlay')).toBeTruthy()
    })
  })

  it('clicking Skip in annotation goes straight to the form', async () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => {
      expect(screen.getByTestId('annotation-overlay')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('annotation-skip'))
    expect(screen.getByTestId('feedback-panel')).toBeTruthy()
    expect(screen.queryByTestId('annotation-overlay')).toBeNull()
  })

  it('clicking Next in annotation goes to the form', async () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => {
      expect(screen.getByTestId('annotation-overlay')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('annotation-next'))
    expect(screen.getByTestId('feedback-panel')).toBeTruthy()
  })

  it('shows a screenshot thumbnail in the feedback form', async () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => {
      expect(screen.getByTestId('annotation-overlay')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('annotation-skip'))
    expect(screen.getByTestId('feedback-screenshot-thumb')).toBeTruthy()
  })

  it('shows category buttons in the feedback panel', async () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => screen.getByTestId('annotation-overlay'))
    fireEvent.click(screen.getByTestId('annotation-skip'))

    expect(screen.getByText('Bug')).toBeTruthy()
    expect(screen.getByText('Feature')).toBeTruthy()
    expect(screen.getByText('Task')).toBeTruthy()
  })

  it('submit button is disabled when description is empty', async () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => screen.getByTestId('annotation-overlay'))
    fireEvent.click(screen.getByTestId('annotation-skip'))

    const submit = screen.getByTestId('feedback-submit')
    expect(submit.disabled).toBe(true)
  })

  it('submits feedback with screenshot via API and shows success', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ created: true, issueNumber: 42, url: 'https://github.com/test/42' }),
    })

    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => screen.getByTestId('annotation-overlay'))
    fireEvent.click(screen.getByTestId('annotation-skip'))

    fireEvent.click(screen.getByTestId('feedback-cat-bug'))
    fireEvent.change(screen.getByTestId('feedback-description'), {
      target: { value: 'Something broke' },
    })
    fireEvent.click(screen.getByTestId('feedback-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('feedback-success')).toBeTruthy()
    })

    // Verify the API was called with correct payload including metadata
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/feedback',
      expect.objectContaining({ method: 'POST' }),
    )
    const sentBody = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(sentBody.category).toBe('bug')
    expect(sentBody.description).toBe('Something broke')
    expect(sentBody.screenshot).toBe('data:image/jpeg;base64,TESTDATA')
    expect(sentBody.metadata).toBeDefined()
    expect(sentBody.metadata.url).toBeTruthy()
    expect(sentBody.metadata.browser).toBeTruthy()
    expect(sentBody.metadata.os).toBeTruthy()
    expect(sentBody.metadata.viewport).toBeTruthy()
    expect(sentBody.metadata.timestamp).toBeTruthy()
  })

  it('shows a friendly error when fetch fails with network error', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => screen.getByTestId('annotation-overlay'))
    fireEvent.click(screen.getByTestId('annotation-skip'))

    fireEvent.change(screen.getByTestId('feedback-description'), {
      target: { value: 'Some feedback' },
    })
    fireEvent.click(screen.getByTestId('feedback-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('feedback-error')).toBeTruthy()
    })

    expect(screen.getByText(/Unable to reach the feedback server/)).toBeTruthy()
  })

  it('shows error message when API returns an error', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Feedback service is not configured' }),
    })

    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => screen.getByTestId('annotation-overlay'))
    fireEvent.click(screen.getByTestId('annotation-skip'))

    fireEvent.change(screen.getByTestId('feedback-description'), {
      target: { value: 'Some feedback' },
    })
    fireEvent.click(screen.getByTestId('feedback-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('feedback-error')).toBeTruthy()
    })

    expect(screen.getByText('Feedback service is not configured')).toBeTruthy()
  })

  it('shows annotation overlay with blank canvas when screenshot capture fails', async () => {
    const { default: html2canvas } = await import('html2canvas')
    html2canvas.mockRejectedValueOnce(new Error('canvas tainted'))

    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => {
      expect(screen.getByTestId('annotation-overlay')).toBeTruthy()
    })
  })

  it('renders annotation canvas placeholder when screenshot image fails to decode', async () => {
    const { default: html2canvas } = await import('html2canvas')
    const fakeCanvas = { toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,TESTDATA'), width: 800, height: 600 }
    html2canvas.mockResolvedValueOnce(fakeCanvas)

    // Force the Image element to immediately fire onerror
    const OriginalImage = global.Image
    try {
      global.Image = class {
        constructor() {}
        set src(_val) { if (this.onerror) setTimeout(() => this.onerror(), 0) }
      }

      render(<BugDropWidget />)
      fireEvent.click(screen.getByTestId('feedback-button'))

      await waitFor(() => {
        expect(screen.getByTestId('annotation-overlay')).toBeTruthy()
      })
      expect(screen.getByTestId('annotation-canvas')).toBeTruthy()
    } finally {
      global.Image = OriginalImage
    }
  })

  it('closes everything when button is clicked while open', async () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => screen.getByTestId('annotation-overlay'))

    // Click button again to close
    fireEvent.click(screen.getByTestId('feedback-button'))
    expect(screen.queryByTestId('annotation-overlay')).toBeNull()
    expect(screen.queryByTestId('feedback-panel')).toBeNull()
  })

  it('passes onclone and allowTaint options to html2canvas for DOM sanitization', async () => {
    const { default: html2canvas } = await import('html2canvas')
    html2canvas.mockClear()

    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => {
      expect(screen.getByTestId('annotation-overlay')).toBeTruthy()
    })

    const callArgs = html2canvas.mock.calls[0]
    expect(callArgs[1]).toHaveProperty('onclone')
    expect(typeof callArgs[1].onclone).toBe('function')
    expect(callArgs[1]).toHaveProperty('allowTaint', true)
    expect(callArgs[1]).toHaveProperty('backgroundColor')
  })

  it('closes the panel when close button is clicked', async () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    await waitFor(() => screen.getByTestId('annotation-overlay'))
    fireEvent.click(screen.getByTestId('annotation-skip'))
    expect(screen.getByTestId('feedback-panel')).toBeTruthy()

    fireEvent.click(screen.getByTestId('feedback-close'))
    expect(screen.queryByTestId('feedback-panel')).toBeNull()
  })
})
