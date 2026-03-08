import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { useAlertService } from '../hooks/useAlertService'
import { useToast } from './ToastContext'

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children, burndown, preferences, onPreferencesChange, initialBalance, budgetVariance }) {
  const [panelOpen, setPanelOpen] = useState(false)
  const { addToast } = useToast()

  const {
    notifications,
    allNotifications,
    unreadCount,
    highestSeverity,
    dismiss,
    dismissAll,
  } = useNotifications(burndown, preferences, initialBalance, { addToast, onPreferencesChange, budgetVariance })

  // ── Push notification integration ──
  const { evaluateAlerts } = useAlertService(preferences, onPreferencesChange)
  const pushEvalRef = useRef(null)

  useEffect(() => {
    if (!preferences?.push?.enabled || !preferences?.push?.ntfyTopic) return
    if (!notifications || notifications.length === 0) return

    // Debounce push evaluation to avoid rapid-fire API calls
    clearTimeout(pushEvalRef.current)
    pushEvalRef.current = setTimeout(() => {
      evaluateAlerts(notifications)
    }, 10000) // 10s debounce — notifications settle before pushing

    return () => clearTimeout(pushEvalRef.current)
  }, [notifications, preferences?.push?.enabled, preferences?.push?.ntfyTopic, evaluateAlerts])

  const openPanel = useCallback(() => setPanelOpen(true), [])
  const closePanel = useCallback(() => setPanelOpen(false), [])
  const togglePanel = useCallback(() => setPanelOpen(prev => !prev), [])

  const updatePreferences = useCallback((updates) => {
    onPreferencesChange(prev => ({ ...prev, ...updates }))
  }, [onPreferencesChange])

  const updateThreshold = useCallback((key, value) => {
    onPreferencesChange(prev => ({
      ...prev,
      thresholds: { ...prev.thresholds, [key]: value },
    }))
  }, [onPreferencesChange])

  const snooze = useCallback((duration) => {
    const until = new Date(Date.now() + duration).toISOString()
    onPreferencesChange(prev => ({ ...prev, mutedUntil: until }))
  }, [onPreferencesChange])

  const unsnooze = useCallback(() => {
    onPreferencesChange(prev => ({ ...prev, mutedUntil: null }))
  }, [onPreferencesChange])

  return (
    <NotificationsContext.Provider value={{
      notifications,
      allNotifications,
      unreadCount,
      highestSeverity,
      dismiss,
      dismissAll,
      panelOpen,
      openPanel,
      closePanel,
      togglePanel,
      preferences,
      onPreferencesChange,
      updatePreferences,
      updateThreshold,
      snooze,
      unsnooze,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsContext must be used inside NotificationsProvider')
  return ctx
}
