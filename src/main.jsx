import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import ErrorBoundary from './components/common/ErrorBoundary.jsx'
import BugDropWidget from './components/feedback/BugDropWidget.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary level="page">
      <ThemeProvider>
        <BugDropWidget />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
