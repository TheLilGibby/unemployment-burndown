import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { API_BASE, getToken } from '../../utils/apiClient'

/**
 * Consent modal shown before opening Plaid Link.
 * User must explicitly agree to data collection before proceeding.
 * Records consent server-side with timestamp for Plaid production audit requirements.
 * Rendered via portal to escape header's backdrop-filter stacking context.
 */
export default function PlaidConsentModal({ onAccept, onDecline }) {
  const handleAccept = async () => {
    // Record consent server-side for audit trail before proceeding
    try {
      const token = getToken()
      if (token) {
        await fetch(`${API_BASE}/api/privacy/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            consentType: 'plaid_data_access',
            consentVersion: '1.1',
          }),
        })
      }
    } catch {
      // Don't block the flow if consent recording fails — proceed with link
    }
    onAccept()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div role="dialog" aria-modal="true" className="theme-card rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border"
        style={{ borderColor: 'var(--border-default)' }}>
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--accent-blue)' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Connect Your Bank Account
            </h2>
          </div>

          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            By connecting your bank account through Plaid, you consent to the following:
          </p>

          <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }}>&#9679;</span>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>Account data:</strong> We will access your account balances, account names,
                account types, and last 4 digits of account numbers.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }}>&#9679;</span>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>Transaction history:</strong> We will access your transaction history
                including dates, amounts, merchant names, and categories.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }}>&#9679;</span>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>Purpose:</strong> This data is used solely to display your financial
                overview and calculate savings runway projections.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }}>&#9679;</span>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>Storage:</strong> Your data is stored encrypted on secure servers. We do
                not sell or share your data with third parties.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent-blue)' }}>&#9679;</span>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>Revocation:</strong> You can disconnect your bank account at any time
                through the app, which will delete the stored access token.
              </span>
            </div>
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            By clicking "Agree & Connect," you consent to the collection and processing of your
            financial data as described above and in our{' '}
            <Link to="/privacy" className="hover:underline" style={{ color: 'var(--accent-blue)' }}>
              Privacy Policy
            </Link>.
            {' '}For more about how Plaid handles your data, see{' '}
            <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer"
              className="hover:underline" style={{ color: 'var(--accent-blue)' }}>
              Plaid's End User Privacy Policy
            </a>.
          </p>
        </div>

        <div className="px-6 py-4 flex gap-3 justify-end"
          style={{ backgroundColor: 'var(--bg-input)', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={onDecline}
            className="px-4 py-2 text-sm rounded-lg border transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--border-default)',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm rounded-lg text-white transition-colors font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--accent-blue)' }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            Agree & Connect
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
