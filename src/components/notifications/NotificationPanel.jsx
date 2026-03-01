import { useEffect, useRef } from 'react'
import { X, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { useNotificationsContext } from '../../context/NotificationsContext'

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }
const SEVERITY_COLORS = {
  critical: 'var(--accent-red)',
  warning: 'var(--accent-amber)',
  info: 'var(--accent-emerald)',
}

function SeverityIcon({ severity }) {
  const size = 13
  if (severity === 'critical') return <AlertCircle size={size} />
  if (severity === 'warning') return <AlertTriangle size={size} />
  return <Info size={size} />
}

export default function NotificationPanel() {
  const { notifications, panelOpen, closePanel, dismiss, dismissAll } = useNotificationsContext()
  const panelRef = useRef(null)

  useEffect(() => {
    if (!panelOpen) return
    const handler = (e) => { if (e.key === 'Escape') closePanel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panelOpen, closePanel])

  useEffect(() => {
    if (!panelOpen) return
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        closePanel()
      }
    }
    // Delay to avoid the toggle click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [panelOpen, closePanel])

  if (!panelOpen) return null

  const sorted = [...notifications].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )

  return (
    <div
      ref={panelRef}
      className="fixed z-[60] flex flex-col rounded-lg"
      style={{
        top: 48,
        right: 8,
        width: 'min(340px, calc(100vw - 16px))',
        maxHeight: 'min(420px, calc(100vh - 64px))',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.1)',
        animation: 'notifDropIn 0.15s ease-out',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          Notifications
          {notifications.length > 0 && (
            <span className="ml-1.5 font-normal" style={{ color: 'var(--text-muted)' }}>
              {notifications.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {notifications.length > 0 && (
            <button
              onClick={dismissAll}
              className="text-xs px-1.5 py-0.5 rounded transition-colors hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear all
            </button>
          )}
          <button
            onClick={closePanel}
            className="p-0.5 rounded hover:opacity-60 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close notifications"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8 gap-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            <CheckCircle2 size={20} style={{ opacity: 0.3 }} />
            <p className="text-xs">You're all caught up</p>
          </div>
        ) : (
          <div className="py-1">
            {sorted.map(notif => (
              <div
                key={notif.id}
                className="flex items-start gap-2 px-3 py-2 transition-colors"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: SEVERITY_COLORS[notif.severity] }}
                >
                  <SeverityIcon severity={notif.severity} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {notif.title}
                  </p>
                  <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {notif.message}
                  </p>
                </div>
                <button
                  onClick={() => dismiss(notif.id)}
                  className="flex-shrink-0 p-0.5 rounded hover:opacity-60 transition-opacity mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                  title="Dismiss"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes notifDropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
