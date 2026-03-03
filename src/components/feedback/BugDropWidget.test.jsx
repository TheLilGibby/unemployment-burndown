import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/test-utils'
import BugDropWidget from './BugDropWidget'

describe('BugDropWidget', () => {
  let fetchSpy

  beforeEach(() => {
    // Ensure matchMedia mock is present
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

  it('opens the feedback panel when button is clicked', () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))
    expect(screen.getByTestId('feedback-panel')).toBeTruthy()
    expect(screen.getByText('Send Feedback')).toBeTruthy()
  })

  it('closes the panel when close button is clicked', () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))
    expect(screen.getByTestId('feedback-panel')).toBeTruthy()

    fireEvent.click(screen.getByTestId('feedback-close'))
    expect(screen.queryByTestId('feedback-panel')).toBeNull()
  })

  it('shows category buttons', () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    expect(screen.getByText('Bug Report')).toBeTruthy()
    expect(screen.getByText('Feature Request')).toBeTruthy()
    expect(screen.getByText('Question')).toBeTruthy()
  })

  it('submit button is disabled when description is empty', () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    const submit = screen.getByTestId('feedback-submit')
    expect(submit.disabled).toBe(true)
  })

  it('shows the screenshot button in the panel', () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    const btn = screen.getByTestId('feedback-screenshot')
    expect(btn).toBeTruthy()
    expect(btn.textContent).toContain('Screenshot')
  })

  it('submits feedback via API and shows success (no screenshot)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ created: true, issueNumber: 42, url: 'https://github.com/test/42' }),
    })

    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    fireEvent.click(screen.getByTestId('feedback-cat-bug_report'))
    fireEvent.change(screen.getByTestId('feedback-description'), {
      target: { value: 'Something broke' },
    })
    fireEvent.click(screen.getByTestId('feedback-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('feedback-success')).toBeTruthy()
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ category: 'bug_report', description: 'Something broke', screenshotUrl: null }),
      }),
    )
  })

  it('shows error message when API fails', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Feedback service is not configured' }),
    })

    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    fireEvent.change(screen.getByTestId('feedback-description'), {
      target: { value: 'Some feedback' },
    })
    fireEvent.click(screen.getByTestId('feedback-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('feedback-error')).toBeTruthy()
    })

    expect(screen.getByText('Feedback service is not configured')).toBeTruthy()
  })
})
