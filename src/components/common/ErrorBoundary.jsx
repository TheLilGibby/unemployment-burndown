import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

/**
 * Error Boundary component that catches JavaScript errors in child components.
 * Displays a fallback UI instead of crashing the entire app.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
    
    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Use fallback render function if provided
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          reset: this.handleReset,
        })
      }

      // Default fallback UI
      const { level = 'page' } = this.props
      
      if (level === 'component') {
        return <ComponentErrorFallback onRetry={this.handleReset} />
      }
      
      if (level === 'section') {
        return <SectionErrorFallback onRetry={this.handleReset} error={this.state.error} />
      }

      return (
        <PageErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleReset}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Minimal fallback for component-level errors
 */
function ComponentErrorFallback({ onRetry }) {
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-medium">Something went wrong</span>
        <button
          onClick={onRetry}
          className="ml-auto text-xs px-2 py-1 bg-red-100 dark:bg-red-900/40 rounded hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

/**
 * Fallback for section-level errors (charts, panels, etc.)
 */
function SectionErrorFallback({ onRetry, error }) {
  return (
    <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
      <div className="flex flex-col items-center text-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <div>
          <h3 className="font-semibold text-red-700 dark:text-red-400">
            This section encountered an error
          </h3>
          <p className="text-sm text-red-600 dark:text-red-500 mt-1">
            {error?.message || 'An unexpected error occurred'}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  )
}

/**
 * Full-page fallback for critical errors
 */
function PageErrorFallback({ error, errorInfo, onRetry, onReload, onGoHome }) {
  const isDev = import.meta.env.DEV

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Oops! Something went wrong
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We're sorry, but something unexpected happened. Don't worry — your data is safe.
          </p>

          {isDev && error && (
            <div className="w-full mb-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-left overflow-auto">
              <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
                {error.toString()}
              </p>
              {errorInfo?.componentStack && (
                <pre className="mt-2 text-xs text-gray-500 dark:text-gray-500 overflow-x-auto">
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={onRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            
            <button
              onClick={onReload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Reload Page
            </button>
            
            <button
              onClick={onGoHome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              <Home className="w-4 h-4" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ErrorBoundary
export { ComponentErrorFallback, SectionErrorFallback, PageErrorFallback }
