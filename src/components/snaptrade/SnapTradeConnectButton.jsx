import { useState, useCallback } from 'react'

/**
 * "Connect Brokerage" button that opens the SnapTrade Connection Portal.
 *
 * Props:
 *   connect         – async fn that registers user + opens portal popup
 *   connectionCount – number of connected brokerages
 *   syncing         – boolean, true while a sync is in progress
 */
export default function SnapTradeConnectButton({ connect, connectionCount = 0, syncing = false }) {
  const [connecting, setConnecting] = useState(false)

  const handleClick = useCallback(async () => {
    setConnecting(true)
    try {
      await connect()
    } catch {
      // Error surfaced via useSnapTrade's error state
    }
    setConnecting(false)
  }, [connect])

  return (
    <button
      onClick={handleClick}
      disabled={connecting || syncing}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
      style={{
        borderColor: connectionCount > 0 ? 'var(--accent-teal, #14b8a6)' : 'var(--accent-blue)',
        background: connectionCount > 0 ? 'rgba(20, 184, 166, 0.1)' : 'rgba(59, 130, 246, 0.1)',
        color: connectionCount > 0 ? 'var(--accent-teal, #14b8a6)' : 'var(--accent-blue)',
        opacity: (connecting || syncing) ? 0.6 : 1,
        cursor: (connecting || syncing) ? 'wait' : 'pointer',
      }}
      title={connectionCount > 0 ? 'Connect another brokerage' : 'Connect your brokerage via SnapTrade'}
    >
      {/* Investment chart icon */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <span className="hidden sm:inline">
        {connecting ? 'Connecting...' : syncing ? 'Syncing...' : connectionCount > 0 ? `${connectionCount} Brokerage${connectionCount > 1 ? 's' : ''}` : 'Connect Brokerage'}
      </span>
      {connectionCount > 0 && !connecting && !syncing && (
        <span
          className="text-xs font-semibold px-1 rounded-full tabular-nums"
          style={{
            background: 'var(--accent-teal, #14b8a6)',
            color: '#fff',
            fontSize: '10px',
            lineHeight: '16px',
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {connectionCount}
        </span>
      )}
    </button>
  )
}
