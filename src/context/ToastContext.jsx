import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

const TOAST_TTL = 8000
const MAX_TOASTS = 3

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({ title, message, severity = 'info', ttl = TOAST_TTL, action }) => {
    const id = crypto.randomUUID()
    const toast = { id, title, message, severity, action }
    setToasts(prev => [...prev, toast].slice(-MAX_TOASTS))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, ttl)
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((title, message) => addToast({ title, message, severity: 'success' }), [addToast])
  const error   = useCallback((title, message) => addToast({ title, message, severity: 'error' }), [addToast])
  const warning = useCallback((title, message) => addToast({ title, message, severity: 'warning' }), [addToast])
  const info    = useCallback((title, message) => addToast({ title, message, severity: 'info' }), [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
