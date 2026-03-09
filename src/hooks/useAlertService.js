import { useCallback, useRef, useState } from 'react'
import { API_BASE, authHeaders } from '../utils/apiClient'

/**
 * Hook that provides methods to send push notifications via the backend ntfy.sh integration.
 *
 * @param {object} preferences - notificationPreferences from state
 * @param {function} onPreferencesChange - setter for notificationPreferences
 */
export function useAlertService(preferences, onPreferencesChange) {
  const pendingRef = useRef(false)
  const [error, setError] = useState(null)

  /**
   * Evaluate and send push alerts for active notifications + category thresholds.
   * Deduplicates by tracking sentAlertIds in preferences.
   */
  const evaluateAlerts = useCallback(async (notifications) => {
    const push = preferences?.push
    if (!push?.enabled || !push?.ntfyTopic) return
    if (pendingRef.current) return
    pendingRef.current = true

    try {
      const enabledCategoryAlerts = (preferences.categoryAlerts || [])
        .filter(a => a.enabled)
        .map(({ categoryKey, categoryLabel, monthlyLimit }) => ({
          categoryKey,
          categoryLabel,
          monthlyLimit,
        }))

      const res = await fetch(`${API_BASE}/api/alerts/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          notifications: notifications.filter(n => n.severity !== 'info'),
          categoryAlerts: enabledCategoryAlerts,
          ntfyTopic: push.ntfyTopic,
          ntfyToken: push.ntfyToken || '',
          redactAmounts: push.redactAmounts !== false,
          sentAlertIds: push.sentAlertIds || [],
        }),
      })

      if (!res.ok) {
        console.warn(`[useAlertService] evaluate failed: HTTP ${res.status}`)
        return
      }

      const data = await res.json()
      if (data.results?.length > 0) {
        const newSentIds = data.results
          .filter(r => r.sent)
          .map(r => r.id)

        if (newSentIds.length > 0 && onPreferencesChange) {
          onPreferencesChange(prev => ({
            ...prev,
            push: {
              ...prev.push,
              sentAlertIds: [...new Set([...(prev.push?.sentAlertIds || []), ...newSentIds])],
            },
          }))
        }
      }
    } catch (err) {
      const msg = err.message || 'Alert evaluation failed'
      console.warn('[useAlertService] evaluate error:', msg)
      setError(msg)
    } finally {
      pendingRef.current = false
    }
  }, [preferences, onPreferencesChange])

  /**
   * Send a test notification to verify the topic is configured correctly.
   */
  const sendTestAlert = useCallback(async (ntfyTopic, ntfyToken) => {
    const res = await fetch(`${API_BASE}/api/alerts/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ntfyTopic, ntfyToken: ntfyToken || '' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    return res.json()
  }, [])

  /**
   * Reset sent alert IDs (e.g. at the start of a new month or when user wants re-alerts).
   */
  const resetSentAlerts = useCallback(() => {
    if (!onPreferencesChange) return
    onPreferencesChange(prev => ({
      ...prev,
      push: {
        ...prev.push,
        sentAlertIds: [],
      },
    }))
  }, [onPreferencesChange])

  return {
    evaluateAlerts,
    sendTestAlert,
    resetSentAlerts,
    error,
  }
}
