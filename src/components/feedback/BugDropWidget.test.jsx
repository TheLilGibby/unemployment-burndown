import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '../../test/test-utils'
import BugDropWidget from './BugDropWidget'

describe('BugDropWidget', () => {
  let openSpy

  beforeEach(() => {
    // Ensure matchMedia mock is present (setup.js provides it, but guard against clearing)
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
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    openSpy.mockRestore()
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

  it('opens GitHub issue URL on submit', () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))

    // Select a category
    fireEvent.click(screen.getByTestId('feedback-cat-bug_report'))

    // Type a description
    fireEvent.change(screen.getByTestId('feedback-description'), {
      target: { value: 'Something broke' },
    })

    // Submit
    fireEvent.click(screen.getByTestId('feedback-submit'))

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('github.com/RAG-Consulting-LLC/unemployment-burndown/issues/new'),
      '_blank',
      'noopener,noreferrer',
    )

    // Panel should close after submit
    expect(screen.queryByTestId('feedback-panel')).toBeNull()
  })

  it('submits without a category or description', () => {
    render(<BugDropWidget />)
    fireEvent.click(screen.getByTestId('feedback-button'))
    fireEvent.click(screen.getByTestId('feedback-submit'))

    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/RAG-Consulting-LLC/unemployment-burndown/issues/new',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
