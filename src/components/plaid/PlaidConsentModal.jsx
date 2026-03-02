import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

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
      const token = sessionStorage.getItem(TOKEN_KEY)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-blue-600 dark:text-blue-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Connect Your Bank Account
            </h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            By connecting your bank account through Plaid, you consent to the following:
          </p>

          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex gap-2">
              <span className="text-blue-500 mt-0.5 shrink-0">&#9679;</span>
              <span>
                <strong>Account data:</strong> We will access your account balances, account names,
                account types, and last 4 digits of account numbers.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-500 mt-0.5 shrink-0">&#9679;</span>
              <span>
                <strong>Transaction history:</strong> We will access your transaction history
                including dates, amounts, merchant names, and categories.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-500 mt-0.5 shrink-0">&#9679;</span>
              <span>
                <strong>Purpose:</strong> This data is used solely to display your financial
                overview and calculate savings runway projections.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-500 mt-0.5 shrink-0">&#9679;</span>
              <span>
                <strong>Storage:</strong> Your data is stored encrypted on secure servers. We do
                not sell or share your data with third parties.
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-500 mt-0.5 shrink-0">&#9679;</span>
              <span>
                <strong>Revocation:</strong> You can disconnect your bank account at any time
                through the app, which will delete the stored access token.
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            By clicking "Agree & Connect," you consent to the collection and processing of your
            financial data as described above and in our{' '}
            <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
              Privacy Policy
            </Link>.
            {' '}For more about how Plaid handles your data, see{' '}
            <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline">
              Plaid's End User Privacy Policy
            </a>.
          </p>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex gap-3 justify-end">
          <button
            onClick={onDecline}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
          >
            Agree & Connect
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
