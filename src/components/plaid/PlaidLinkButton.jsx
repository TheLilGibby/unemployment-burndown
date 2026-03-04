import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import PlaidConsentModal from './PlaidConsentModal'

/**
 * "Add Bank" button that opens the Plaid Link modal.
 * Shows a consent screen before the first connection.
 *
 * Props:
 *   createLinkToken – async fn that returns a link_token string
 *   exchangeToken   – async fn(publicToken, metadata) called on success
 *   syncAll         – async fn() to trigger a balance sync after linking
 *   linkedCount     – number of already-connected institutions
 *   syncing         – boolean, true while a sync is in progress
 */
export default function PlaidLinkButton({ createLinkToken, exchangeToken, syncAll, linkedCount = 0, syncing = false }) {
  const [linkToken, setLinkToken] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [showConsent, setShowConsent] = useState(false)

  // Show consent modal when user clicks the button
  const handleClick = useCallback(() => {
    setShowConsent(true)
  }, [])

  // After consent is given, fetch a link token and open Plaid Link
  const handleConsentAccept = useCallback(async () => {
    setShowConsent(false)
    setPreparing(true)
    try {
      const token = await createLinkToken()
      setLinkToken(token)
    } catch {
      // Error is surfaced via usePlaid's error state
    }
    setPreparing(false)
  }, [createLinkToken])

  const handleConsentDecline = useCallback(() => {
    setShowConsent(false)
  }, [])

  // Plaid Link callbacks
  const onSuccess = useCallback(async (publicToken, metadata) => {
    setLinkToken(null)
    try {
      await exchangeToken(publicToken, metadata)
      await syncAll()
    } catch {
      // Errors surfaced by usePlaid
    }
  }, [exchangeToken, syncAll])

  const onExit = useCallback(() => {
    setLinkToken(null)
  }, [])

  const config = {
    token: linkToken,
    onSuccess,
    onExit,
  }

  const { open, ready } = usePlaidLink(config)

  // Auto-open Plaid Link once the token is ready
  useEffect(() => {
    if (linkToken && ready) {
      open()
    }
  }, [linkToken, ready, open])

  const disabled = preparing || syncing
  const label = preparing ? 'Connecting...' : syncing ? 'Syncing...' : linkedCount > 0 ? 'Add Bank' : 'Connect Bank'

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
        style={{
          borderColor: 'var(--accent-blue)',
          background: 'rgba(59, 130, 246, 0.1)',
          color: 'var(--accent-blue)',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'wait' : 'pointer',
        }}
        title={linkedCount > 0 ? 'Connect another bank account' : 'Connect your bank via Plaid'}
      >
        {/* Plus icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>{label}</span>
      </button>

      {showConsent && (
        <PlaidConsentModal
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
        />
      )}
    </>
  )
}
