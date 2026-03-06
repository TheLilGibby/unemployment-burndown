import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'
import { ToastProvider } from '../context/ToastContext'

/**
 * Custom render function that wraps components with common providers
 */
function customRender(ui, options = {}) {
  const { route = '/', ...renderOptions } = options

  window.history.pushState({}, 'Test page', route)

  function Wrapper({ children }) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            {children}
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Re-export everything from testing-library
export * from '@testing-library/react'

// Override render with our custom version
export { customRender as render }
