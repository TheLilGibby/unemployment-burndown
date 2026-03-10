import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { HiddenModeProvider } from './context/HiddenModeContext.jsx'
import ErrorBoundary from './components/common/ErrorBoundary.jsx'
import ScrollToTop from './components/common/ScrollToTop.jsx'
// import BugDropWidget from './components/feedback/BugDropWidget.jsx'
// Validate environment variables at startup (logs warnings for missing vars)
import './utils/env.js'

// Strip trailing slash to prevent Amplify refresh routing issues
const { pathname, search, hash } = window.location;
if (pathname.length > 1 && pathname.endsWith('/')) {
  window.history.replaceState(null, '', pathname.slice(0, -1) + search + hash);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary level="page">
      <ThemeProvider>
        <HiddenModeProvider>
          {/* <BugDropWidget /> */}
          <BrowserRouter>
            <ScrollToTop />
            <App />
          </BrowserRouter>
        </HiddenModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
