import { Link } from 'react-router-dom'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-8 inline-block">
          &larr; Back to App
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Effective Date: February 27, 2026 &middot; Last Updated: March 2, 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
            <p>
              RAG Consulting LLC ("we," "us," or "our") operates the Financial Burndown Tracker
              application (the "Service"). This Privacy Policy explains how we collect, use, store,
              and protect your personal and financial information when you use our Service,
              including when you connect financial accounts through Plaid Inc. ("Plaid").
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>

            <h3 className="font-medium mt-3 mb-1">2.1 Information You Provide Directly</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account credentials (username and password)</li>
              <li>Names of household members or financial personas</li>
              <li>Financial data you enter manually: savings balances, expenses, income, subscriptions, credit card details, investment amounts, and job scenario information</li>
              <li>Retirement planning information: target retirement age, contribution amounts, nest egg goals</li>
            </ul>

            <h3 className="font-medium mt-3 mb-1">2.2 Information Collected Through Plaid</h3>
            <p>
              When you choose to connect a bank account through Plaid, we receive the following
              information from your financial institution via the Plaid API:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account balances (current, available, and credit limits)</li>
              <li>Account metadata (account name, type, subtype, last 4 digits)</li>
              <li>Institution name and identifier</li>
              <li>Transaction history (date, merchant name, amount, category)</li>
            </ul>
            <p className="mt-2">
              We do not receive or store your bank login credentials. Plaid handles authentication
              directly and securely. For more information about how Plaid handles your data, see{' '}
              <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline">
                Plaid's End User Privacy Policy
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide financial tracking and burndown analysis</li>
              <li>Display your account balances and transaction history</li>
              <li>Calculate savings runway projections and scenario comparisons</li>
              <li>Synchronize your financial data across sessions</li>
              <li>Generate retirement projections based on your inputs</li>
            </ul>
            <p className="mt-2">
              We do <strong>not</strong> sell, rent, or share your personal or financial data with
              third parties for their marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Consent</h2>
            <p>We obtain your consent for the collection, processing, and storage of your data in the following ways:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Account registration:</strong> By creating an account, you consent to the collection
                and processing of the information you provide as described in this Privacy Policy.
              </li>
              <li>
                <strong>Bank account linking:</strong> Before connecting a bank account through Plaid, we
                present a detailed consent disclosure that describes exactly what data will be accessed,
                how it will be used, and how it will be stored. You must explicitly agree before any
                financial data is retrieved. This consent is recorded with a timestamp for audit purposes.
              </li>
              <li>
                <strong>Withdrawal of consent:</strong> You may withdraw consent at any time by
                disconnecting your bank accounts through the app or by deleting your account.
                Withdrawal of consent does not affect the lawfulness of processing performed before
                the withdrawal.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Data Storage and Security</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your data is stored in Amazon Web Services (AWS) infrastructure located in the United States.</li>
              <li>Data at rest is encrypted using AES-256 server-side encryption (SSE-S3).</li>
              <li>Data in transit is encrypted using TLS 1.2 or higher.</li>
              <li>Plaid access tokens are stored in encrypted DynamoDB tables, accessible only by authorized backend services.</li>
              <li>Direct public access to data storage is blocked; all data access is routed through authenticated API endpoints.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Data Sharing</h2>
            <p>We share your data only with the following third parties, solely to provide the Service:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Plaid Inc.</strong> — to connect your bank accounts and retrieve financial data on your behalf</li>
              <li><strong>Amazon Web Services (AWS)</strong> — to host and store your data securely</li>
            </ul>
            <p className="mt-2">
              We do not sell your personal information. We may disclose your information if required
              by law, court order, or governmental regulation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Data Retention and Deletion</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your financial data is retained for as long as you have an active account with the Service.</li>
              <li>If you disconnect a bank account, we delete the associated Plaid access token and stop syncing data from that institution.</li>
              <li>You may delete your account at any time through the Settings page or by contacting us.</li>
              <li>Upon account deletion, all of your data — including financial data, Plaid tokens, transaction history, and any associated organization data — is permanently deleted within 30 days.</li>
              <li>Raw ingested emails (if applicable) are automatically deleted 90 days after processing.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
              <li><strong>Deletion:</strong> Delete your account and all associated data through the app or by contacting us.</li>
              <li><strong>Disconnect:</strong> Disconnect linked bank accounts at any time through the app.</li>
              <li><strong>Portability:</strong> Export your financial data in CSV or JSON format through the app's export feature.</li>
              <li><strong>Withdraw consent:</strong> Withdraw your consent for data processing at any time.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, use the in-app features or contact us at{' '}
              <a href="mailto:privacy@rag-consulting.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                privacy@rag-consulting.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. State-Specific Privacy Rights</h2>
            <h3 className="font-medium mt-3 mb-1">California Residents (CCPA/CPRA)</h3>
            <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA):</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>The right to know what personal information we collect, use, and disclose.</li>
              <li>The right to request deletion of your personal information.</li>
              <li>The right to opt out of the sale of personal information. Note: we do not sell your personal information.</li>
              <li>The right to non-discrimination for exercising your privacy rights.</li>
            </ul>
            <p className="mt-2">
              To submit a verifiable consumer request, contact us at{' '}
              <a href="mailto:privacy@rag-consulting.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                privacy@rag-consulting.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Cookies and Tracking</h2>
            <p>
              The Service does not use tracking cookies, advertising pixels, or analytics services.
              We use browser session storage solely to maintain your authenticated session.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Children's Privacy</h2>
            <p>
              The Service is not intended for use by individuals under 18 years of age. We do not
              knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of material
              changes by updating the "Last Updated" date at the top of this page. Continued use of
              the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, contact us at:
            </p>
            <p className="mt-2">
              RAG Consulting LLC<br />
              Email:{' '}
              <a href="mailto:privacy@rag-consulting.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                privacy@rag-consulting.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
          Version 1.1 &middot; March 2, 2026
        </div>
      </div>
    </div>
  )
}
