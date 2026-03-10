import { useState, useCallback, useEffect, useRef } from 'react'
import { CreditCard, Landmark, TrendingUp, X } from 'lucide-react'
import { usePlaidLink } from 'react-plaid-link'
import PlaidConsentModal from '../plaid/PlaidConsentModal'

/**
 * Modal that lets users choose what type of account to add:
 *   1. Credit Card / Bank Account → Plaid Link flow
 *   2. Investment Brokerage       → SnapTrade flow
 *
 * Props:
 *   open            – boolean, whether modal is visible
 *   onClose         – fn() to close modal
 *   plaid           – { createLinkToken, exchangeToken, linkedItems, syncing }
 *   onSync          – fn() to trigger balance sync after linking
 *   snapTrade       – { generateConnectUrl, fetchAccounts, loading } (optional)
 */
export default function AddAccountTypeModal({ open, onClose, plaid, onSync, snapTrade }) {
  const [showConsent, setShowConsent] = useState(false)
  const [preparingPlaid, setPreparingPlaid] = useState(false)
  const [plaidLinkToken, setPlaidLinkToken] = useState(null)
  const [connectingSnapTrade, setConnectingSnapTrade] = useState(false)
  const [snapTradeError, setSnapTradeError] = useState(null)
  const pollTimerRef = useRef(null)

  // ── Plaid flow (Credit Cards & Bank Accounts) ──

  const handlePlaidChoice = useCallback(() => {
    setShowConsent(true)
  }, [])

  const handleConsentAccept = useCallback(async () => {
    setShowConsent(false)
    setPreparingPlaid(true)
    try {
      const token = await plaid.createLinkToken()
      setPlaidLinkToken(token)
    } catch {
      // Error surfaced via usePlaid
    }
    setPreparingPlaid(false)
  }, [plaid])

  const handleConsentDecline = useCallback(() => {
    setShowConsent(false)
  }, [])

  // Import and use Plaid Link
  // We dynamically trigger the Plaid Link SDK once we have a token
  const PlaidLinkOpener = plaidLinkToken ? (
    <PlaidLinkTrigger
      token={plaidLinkToken}
      onSuccess={async (publicToken, metadata) => {
        setPlaidLinkToken(null)
        onClose()
        try {
          await plaid.exchangeToken(publicToken, metadata)
          await onSync()
        } catch {
          // Errors surfaced by usePlaid
        }
      }}
      onExit={() => {
        setPlaidLinkToken(null)
      }}
    />
  ) : null

  // ── SnapTrade flow (Investment Brokerage) ──

  const handleSnapTradeChoice = useCallback(async () => {
    if (!snapTrade) return
    setConnectingSnapTrade(true)
    setSnapTradeError(null)
    try {
      const redirectUrl = await snapTrade.generateConnectUrl('FIDELITY')
      const popup = window.open(redirectUrl, '_blank', 'width=800,height=700,scrollbars=yes')
      if (popup) {
        pollTimerRef.current = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimerRef.current)
            pollTimerRef.current = null
            setConnectingSnapTrade(false)
            onClose()
            if (snapTrade.fetchAccounts) snapTrade.fetchAccounts()
          }
        }, 500)
      } else {
        // Popup blocked
        setConnectingSnapTrade(false)
        onClose()
        if (snapTrade.fetchAccounts) snapTrade.fetchAccounts()
      }
    } catch (e) {
      setSnapTradeError(e.message)
      setConnectingSnapTrade(false)
    }
  }, [snapTrade, onClose])

  // Reset state and clear poll interval when modal closes
  useEffect(() => {
    if (!open) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      setShowConsent(false)
      setPreparingPlaid(false)
      setPlaidLinkToken(null)
      setConnectingSnapTrade(false)
      setSnapTradeError(null)
    }
  }, [open])

  if (!open) return null

  const isLoading = preparingPlaid || connectingSnapTrade || plaid?.syncing

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          role="dialog" aria-modal="true" className="w-full max-w-md rounded-xl border shadow-2xl"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Add Account
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>

          <p className="px-5 pb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Choose the type of account you'd like to connect.
          </p>

          {/* Account type options */}
          <div className="px-5 pb-5 space-y-2">
            {/* Option 1: Credit Card */}
            <button
              onClick={handlePlaidChoice}
              disabled={isLoading}
              className="w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left"
              style={{
                borderColor: 'var(--border-default)',
                background: 'var(--bg-input)',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'wait' : 'pointer',
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.borderColor = 'var(--accent-orange, #f97316)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(249, 115, 22, 0.12)' }}
              >
                <CreditCard size={20} style={{ color: 'var(--accent-orange, #f97316)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Credit Card
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Track balances, limits, and transactions via Plaid
                </div>
              </div>
            </button>

            {/* Option 2: Bank Account */}
            <button
              onClick={handlePlaidChoice}
              disabled={isLoading}
              className="w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left"
              style={{
                borderColor: 'var(--border-default)',
                background: 'var(--bg-input)',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'wait' : 'pointer',
              }}
              onMouseEnter={e => { if (!isLoading) e.currentTarget.style.borderColor = 'var(--accent-emerald, #10b981)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(16, 185, 129, 0.12)' }}
              >
                <Landmark size={20} style={{ color: 'var(--accent-emerald, #10b981)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Bank Account
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Checking, savings, and money market accounts via Plaid
                </div>
              </div>
            </button>

            {/* Option 3: Investment Brokerage */}
            <button
              onClick={handleSnapTradeChoice}
              disabled={isLoading || !snapTrade}
              className="w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left"
              style={{
                borderColor: 'var(--border-default)',
                background: 'var(--bg-input)',
                opacity: (isLoading || !snapTrade) ? 0.6 : 1,
                cursor: (isLoading || !snapTrade) ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => { if (!isLoading && snapTrade) e.currentTarget.style.borderColor = 'var(--accent-teal, #14b8a6)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(20, 184, 166, 0.12)' }}
              >
                <TrendingUp size={20} style={{ color: 'var(--accent-teal, #14b8a6)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Investment Brokerage
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {snapTrade
                    ? 'Fidelity, Schwab, and other brokerages via SnapTrade'
                    : 'Not yet configured — connect from the Investments panel'}
                </div>
              </div>
            </button>

            {snapTradeError && (
              <p className="text-xs px-1" style={{ color: '#ef4444' }}>{snapTradeError}</p>
            )}

            {preparingPlaid && (
              <p className="text-xs px-1" style={{ color: 'var(--accent-blue)' }}>
                Preparing secure connection...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Plaid consent modal (overlays on top) */}
      {showConsent && (
        <PlaidConsentModal
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
        />
      )}

      {/* Invisible Plaid Link trigger */}
      {PlaidLinkOpener}
    </>
  )
}

/**
 * Helper component that auto-opens Plaid Link when mounted with a token.
 * Uses the same pattern as PlaidLinkButton.
 */
function PlaidLinkTrigger({ token, onSuccess, onExit }) {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit })

  useEffect(() => {
    if (token && ready) {
      open()
    }
  }, [token, ready, open])

  return null
}
