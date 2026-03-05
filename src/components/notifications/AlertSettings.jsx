import { useState, useCallback } from 'react'
import { Smartphone, Plus, Trash2, ExternalLink, TestTube, RefreshCw } from 'lucide-react'
import { STATEMENT_CATEGORIES } from '../../constants/categories'
import { useAlertService } from '../../hooks/useAlertService'

/**
 * AlertSettings — configures push notifications via ntfy.sh
 * and category-based monthly spending alerts.
 *
 * Appears in the UserProfilePage under the Notifications section.
 */
export default function AlertSettings({ preferences, onPreferencesChange }) {
  const push = preferences?.push || { enabled: false, ntfyTopic: '', sentAlertIds: [] }
  const categoryAlerts = preferences?.categoryAlerts || []
  const { sendTestAlert, resetSentAlerts } = useAlertService(preferences, onPreferencesChange)

  const [testStatus, setTestStatus] = useState(null) // 'sending' | 'success' | 'error'
  const [testError, setTestError] = useState(null)
  const [showAddCategory, setShowAddCategory] = useState(false)

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

  const handleTestAlert = async () => {
    if (!push.ntfyTopic) return
    setTestStatus('sending')
    setTestError(null)
    try {
      await sendTestAlert(push.ntfyTopic)
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
            onClick={() => updatePush({ enabled: !push.enabled })}
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
            {/* Topic input */}
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                ntfy Topic
                <span className="text-gray-400 ml-1">(unique name — subscribes your phone to this topic)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. my-burndown-alerts"
                value={push.ntfyTopic || ''}
                onChange={e => updatePush({ ntfyTopic: e.target.value.trim() })}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 mt-1">
                Install the <strong>ntfy</strong> app on iOS/Android, then subscribe to this same topic name.
              </p>
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
