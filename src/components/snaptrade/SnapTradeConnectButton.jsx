import { useState } from 'react'

/**
 * Button that initiates a SnapTrade brokerage connection.
 * Opens the SnapTrade redirect URL in a new window/tab.
 * After the user completes the flow, they return to the app
 * and the callback is processed.
 */
export default function SnapTradeConnectButton({ onConnect, generateConnectUrl, loading: externalLoading }) {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const redirectUrl = await generateConnectUrl('FIDELITY')
      // Open in new window for the redirect-based auth flow
      const popup = window.open(redirectUrl, '_blank', 'width=800,height=700,scrollbars=yes')

      // Poll for the window to close (user completed or cancelled)
      if (popup) {
        const pollTimer = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimer)
            setConnecting(false)
            // Trigger callback — the parent should refresh accounts
            if (onConnect) onConnect()
          }
        }, 1000)
      } else {
        // Popup blocked — provide direct link
        setConnecting(false)
        if (onConnect) onConnect()
      }
    } catch (e) {
      setError(e.message)
      setConnecting(false)
    }
  }

  const isLoading = connecting || externalLoading

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: isLoading ? 'var(--bg-input)' : 'rgba(16, 185, 129, 0.15)',
          color: isLoading ? 'var(--text-muted)' : '#10b981',
          cursor: isLoading ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)' }}
        onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)' }}
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border-subtle)', borderTopColor: '#10b981' }} />
            Connecting...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h5l3-9 4 18 3-9h5" />
            </svg>
            Connect Brokerage (Fidelity)
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>{error}</p>
      )}
    </div>
  )
}
