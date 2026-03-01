import { createContext, useContext, useState, useCallback } from 'react'
import { useNotifications } from '../hooks/useNotifications'

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children, burndown, preferences, onPreferencesChange, initialBalance }) {
  const [panelOpen, setPanelOpen] = useState(false)

  const {
    notifications,
    allNotifications,
    unreadCount,
    highestSeverity,
    dismiss,
    dismissAll,
    toasts,
    removeToast,
  } = useNotifications(burndown, preferences, initialBalance)

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
      toasts,
      removeToast,
      panelOpen,
      openPanel,
      closePanel,
      togglePanel,
      preferences,
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
