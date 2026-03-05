import { useState, useCallback } from 'react'
import { Smartphone, Plus, Trash2, ExternalLink, TestTube, RefreshCw, Eye, EyeOff, Shield, ChevronDown, ChevronUp, Shuffle } from 'lucide-react'
import { STATEMENT_CATEGORIES } from '../../constants/categories'
import { useAlertService } from '../../hooks/useAlertService'

/**
 * Generate a cryptographically random topic name (32 chars, alphanumeric).
 */
function generateSecureTopic() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => chars[b % chars.length]).join('')
}

/**
 * AlertSettings — configures push notifications via ntfy.sh
 * and category-based monthly spending alerts.
 *
 * Appears in the UserProfilePage under the Notifications section.
 */
export default function AlertSettings({ preferences, onPreferencesChange }) {
  const push = preferences?.push || { enabled: false, ntfyTopic: '', ntfyToken: '', redactAmounts: true, sentAlertIds: [] }
  const categoryAlerts = preferences?.categoryAlerts || []
  const { sendTestAlert, resetSentAlerts } = useAlertService(preferences, onPreferencesChange)

  const [testStatus, setTestStatus] = useState(null) // 'sending' | 'success' | 'error'
  const [testError, setTestError] = useState(null)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showTopic, setShowTopic] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [showSecurityTips, setShowSecurityTips] = useState(false)

  const updatePush = useCallback((updates) => {
    onPreferencesChange(prev => ({
      ...prev,
      push: { ...prev.push, ...updates },
    }))
  }, [onPreferencesChange])

  const updateCategoryAlerts = useCallback((newAlerts) => {
    onPreferencesChange(prev => ({
      ...prev,
      categoryAlerts: newAlerts,
    }))
  }, [onPreferencesChange])

  const handleEnablePush = () => {
    const updates = { enabled: !push.enabled }
    // Auto-generate a secure topic when enabling for the first time
    if (!push.enabled && !push.ntfyTopic) {
      updates.ntfyTopic = generateSecureTopic()
    }
    updatePush(updates)
  }

  const handleTestAlert = async () => {
    if (!push.ntfyTopic) return
    setTestStatus('sending')
    setTestError(null)
    try {
      await sendTestAlert(push.ntfyTopic, push.ntfyToken)
      setTestStatus('success')
      setTimeout(() => setTestStatus(null), 3000)
    } catch (err) {
      setTestStatus('error')
      setTestError(err.message)
    }
  }

  const addCategoryAlert = (categoryKey) => {
    const cat = STATEMENT_CATEGORIES.find(c => c.key === categoryKey)
    if (!cat) return
    const exists = categoryAlerts.some(a => a.categoryKey === categoryKey)
    if (exists) return

    updateCategoryAlerts([
      ...categoryAlerts,
      {
        id: `cat_${categoryKey}_${Date.now()}`,
        categoryKey,
        categoryLabel: cat.label,
        monthlyLimit: 0,
        enabled: true,
      },
    ])
    setShowAddCategory(false)
  }

  const removeCategoryAlert = (id) => {
    updateCategoryAlerts(categoryAlerts.filter(a => a.id !== id))
  }

  const updateCategoryLimit = (id, monthlyLimit) => {
    updateCategoryAlerts(
      categoryAlerts.map(a => a.id === id ? { ...a, monthlyLimit } : a)
    )
  }

  const toggleCategoryEnabled = (id) => {
    updateCategoryAlerts(
      categoryAlerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    )
  }

  // Categories not already configured
  const availableCategories = STATEMENT_CATEGORIES.filter(
    c => !categoryAlerts.some(a => a.categoryKey === c.key)
  )

  const inputClass = 'w-full text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'

  return (
    <div className="space-y-5">
      {/* ── Push Notifications ── */}
      <div className="px-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          Push Notifications
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">via ntfy.sh</span>
        </h3>

        {/* Enable toggle */}
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 mb-3">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Enable push alerts</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Send alerts to your phone via the{' '}
              <a
                href="https://ntfy.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
              >
                ntfy app <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <button
            onClick={handleEnablePush}
            className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
            style={{ background: push.enabled ? '#10b981' : '#d1d5db' }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
              style={{ left: push.enabled ? 22 : 2 }}
            />
          </button>
        </div>

        {push.enabled && (
          <div className="space-y-3">
            {/* Privacy warning */}
            <div className="px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Privacy:</strong> Your topic name acts as a password. Anyone who knows it can read your alerts.
                Use the auto-generated name or a long random string. Never share it publicly.
              </p>
            </div>

            {/* Topic input with password mask + generate button */}
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                ntfy Topic
                <span className="text-gray-400 ml-1">(acts as a shared secret)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showTopic ? 'text' : 'password'}
                    placeholder="auto-generated secure topic"
                    value={push.ntfyTopic || ''}
                    onChange={e => updatePush({ ntfyTopic: e.target.value.trim() })}
                    className={inputClass + ' pr-9'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTopic(!showTopic)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title={showTopic ? 'Hide topic' : 'Show topic'}
                  >
                    {showTopic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => updatePush({ ntfyTopic: generateSecureTopic() })}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                  title="Generate new random topic"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Generate
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Install the <strong>ntfy</strong> app on iOS/Android, then subscribe to this same topic name.
              </p>
            </div>

            {/* Access Token (optional) */}
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Access Token
                <span className="text-gray-400 ml-1">(optional — for self-hosted or ntfy Pro)</span>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="tk_..."
                  value={push.ntfyToken || ''}
                  onChange={e => updatePush({ ntfyToken: e.target.value.trim() })}
                  className={inputClass + ' pr-9'}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Required if your ntfy server uses access control. Get a token from your ntfy account settings.
              </p>
            </div>

            {/* Redact amounts toggle */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Hide dollar amounts</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Strip exact dollar amounts from push messages for privacy
                </div>
              </div>
              <button
                onClick={() => updatePush({ redactAmounts: !push.redactAmounts })}
                className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                style={{ background: push.redactAmounts !== false ? '#10b981' : '#d1d5db' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
                  style={{ left: push.redactAmounts !== false ? 22 : 2 }}
                />
              </button>
            </div>

            {/* Test + Reset buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestAlert}
                disabled={!push.ntfyTopic || testStatus === 'sending'}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white transition-colors"
              >
                <TestTube className="w-3.5 h-3.5" />
                {testStatus === 'sending' ? 'Sending...' : 'Send Test'}
              </button>
              <button
                onClick={resetSentAlerts}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Reset sent alerts so they can fire again"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Alerts
              </button>
            </div>

            {testStatus === 'success' && (
              <p className="text-xs text-green-600 dark:text-green-400">Test notification sent! Check your ntfy app.</p>
            )}
            {testStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400">Failed: {testError}</p>
            )}

            {/* Security Tips (collapsible) */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setShowSecurityTips(!showSecurityTips)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Security Tips
                </span>
                {showSecurityTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showSecurityTips && (
                <div className="px-3 pb-3 text-xs text-gray-600 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2">
                  <p>
                    <strong>How it works:</strong> ntfy.sh topics are public by default.
                    Your topic name is the only thing preventing others from reading your alerts.
                  </p>
                  <p>
                    <strong>For maximum privacy, self-host ntfy</strong> with access control enabled
                    (<code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">auth-default-access: deny-all</code>).
                    Then set your server URL and access token above.{' '}
                    <a
                      href="https://docs.ntfy.sh/config/#access-control"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline inline-flex items-center gap-0.5"
                    >
                      Setup guide <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                  <p>
                    <strong>Mobile app auth:</strong> In the ntfy iOS/Android app, you can add your
                    self-hosted server with username/password or token auth under Settings.
                  </p>
                  <p>
                    <strong>Keep &quot;Hide dollar amounts&quot; on</strong> to prevent exact financial
                    figures from appearing in push notifications.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Category Spending Alerts ── */}
      <div className="px-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Category Spending Alerts
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
            (monthly budget limits)
          </span>
        </h3>

        {categoryAlerts.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            No category alerts configured. Add one to get notified when spending exceeds your limit.
          </p>
        ) : (
          <div className="space-y-2 mb-3">
            {categoryAlerts.map(alert => {
              const cat = STATEMENT_CATEGORIES.find(c => c.key === alert.categoryKey)
              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700"
                  style={{ opacity: alert.enabled ? 1 : 0.5 }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: cat?.color || '#6b7280' }}
                  />
                  <span className="text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">
                    {alert.categoryLabel}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">$</span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={alert.monthlyLimit || ''}
                    onChange={e => updateCategoryLimit(alert.id, Number(e.target.value) || 0)}
                    placeholder="limit"
                    className="w-20 text-sm text-right px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => toggleCategoryEnabled(alert.id)}
                    className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                    style={{ background: alert.enabled ? '#10b981' : '#d1d5db' }}
                    title={alert.enabled ? 'Disable' : 'Enable'}
                  >
                    <span
                      className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm"
                      style={{ left: alert.enabled ? 17 : 2 }}
                    />
                  </button>
                  <button
                    onClick={() => removeCategoryAlert(alert.id)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Add category button / dropdown */}
        {showAddCategory ? (
          <div className="space-y-2">
            <select
              onChange={e => { if (e.target.value) addCategoryAlert(e.target.value) }}
              defaultValue=""
              className={inputClass}
            >
              <option value="" disabled>Select a category...</option>
              {availableCategories.map(cat => (
                <option key={cat.key} value={cat.key}>{cat.label}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAddCategory(false)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCategory(true)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Category Alert
          </button>
        )}
      </div>
    </div>
  )
}
