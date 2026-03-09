import { useState, useCallback, useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import PlaidConsentModal from './PlaidConsentModal'
import { useToast } from '../../context/ToastContext'

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
export default function PlaidLinkButton({ createLinkToken, exchangeToken, syncAll, linkedCount = 0, syncing = false, variant = 'button' }) {
  const toast = useToast()
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
    } catch (e) {
      toast.error('Bank Connection Failed', e.message || 'Could not create a link token. Please try again.')
    }
    setPreparing(false)
  }, [createLinkToken, toast])

  const handleConsentDecline = useCallback(() => {
    setShowConsent(false)
  }, [])

  // Plaid Link callbacks
  const onSuccess = useCallback(async (publicToken, metadata) => {
    setLinkToken(null)
    try {
      await exchangeToken(publicToken, metadata)
      await syncAll()
    } catch (e) {
      toast.error('Bank Linking Failed', e.message || 'Could not complete bank linking. Please try again.')
    }
  }, [exchangeToken, syncAll, toast])

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

  // Row variant: looks like account rows in the sidebar
  if (variant === 'row') {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={disabled}
          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all rounded-lg"
          style={{
            background: 'transparent',
            borderLeft: '2px solid transparent',
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? 'wait' : 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 6%, var(--bg-card))' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title={linkedCount > 0 ? 'Connect another bank account' : 'Connect your bank via Plaid'}
        >
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <span className="text-xs" style={{ color: 'var(--accent-blue)' }}>
            {label}
          </span>
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
