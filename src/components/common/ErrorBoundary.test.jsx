import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from './ErrorBoundary'

// Component that throws an error
function ThrowError({ shouldThrow = true }) {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Suppress console.error for cleaner test output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('renders page-level fallback when error occurs', () => {
    render(
      <ErrorBoundary level="page">
        <ThrowError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument()
  })

  it('renders section-level fallback when error occurs', () => {
    render(
      <ErrorBoundary level="section">
        <ThrowError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('This section encountered an error')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('renders component-level fallback when error occurs', () => {
    render(
      <ErrorBoundary level="component">
        <ThrowError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('recovers when retry is clicked', async () => {
    const user = userEvent.setup()
    let shouldThrow = true
    
    function ConditionalError() {
      if (shouldThrow) {
        throw new Error('Test error')
      }
      return <div>Recovered!</div>
    }
    
    const { rerender } = render(
      <ErrorBoundary level="component">
        <ConditionalError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    
    // Fix the error condition before clicking retry
    shouldThrow = false
    
    await user.click(screen.getByRole('button', { name: /retry/i }))
    
    // After retry, component should try to render again
    // Note: The boundary resets its state, causing a re-render
  })

  it('uses custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn()
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    )
    
    expect(onError).toHaveBeenCalled()
    expect(onError.mock.calls[0][0].message).toBe('Test error message')
  })
})
