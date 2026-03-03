import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '../../test/test-utils'
import BugDropWidget from './BugDropWidget'

describe('BugDropWidget', () => {
  beforeEach(() => {
    // Remove any script tags from previous tests
    document.querySelectorAll('script[src*="bugdrop"]').forEach(s => s.remove())
  })

  afterEach(() => {
    document.querySelectorAll('script[src*="bugdrop"]').forEach(s => s.remove())
  })

  it('injects the BugDrop script into the document', () => {
    render(<BugDropWidget />)

    const script = document.querySelector('script[src*="bugdrop"]')
    expect(script).toBeTruthy()
    expect(script.getAttribute('data-repo')).toBe('RAG-Consulting-LLC/unemployment-burndown')
  })

  it('sets data-theme based on resolved theme', () => {
    render(<BugDropWidget />)

    const script = document.querySelector('script[src*="bugdrop"]')
    // Default resolved theme from matchMedia mock is 'light' (matches: false)
    expect(script.getAttribute('data-theme')).toBe('light')
  })

  it('sets position and color attributes', () => {
    render(<BugDropWidget />)

    const script = document.querySelector('script[src*="bugdrop"]')
    expect(script.getAttribute('data-position')).toBe('bottom-right')
    expect(script.getAttribute('data-color')).toBe('#14b8a6')
  })

  it('does not inject duplicate scripts', () => {
    const { unmount } = render(<BugDropWidget />)
    unmount()

    // Re-add a script to simulate it already being present
    const existing = document.createElement('script')
    existing.src = 'https://bugdrop.neonwatty.workers.dev/widget.v1.js'
    document.body.appendChild(existing)

    render(<BugDropWidget />)

    const scripts = document.querySelectorAll('script[src*="bugdrop"]')
    expect(scripts.length).toBe(1)
  })

  it('renders nothing visible', () => {
    const { container } = render(<BugDropWidget />)
    expect(container.innerHTML).toBe('')
  })
})
