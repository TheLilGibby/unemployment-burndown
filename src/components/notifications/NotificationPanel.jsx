import { useEffect, useState } from 'react'
import { X, AlertTriangle, AlertCircle, Info, Settings } from 'lucide-react'
import { useNotificationsContext } from '../../context/NotificationsContext'
import NotificationSettings from './NotificationSettings'

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }
const SEVERITY_COLORS = {
  critical: 'var(--accent-red)',
  warning: 'var(--accent-amber)',
  info: 'var(--accent-emerald)',
}

function SeverityIcon({ severity }) {
  const size = 14
  if (severity === 'critical') return <AlertCircle size={size} />
  if (severity === 'warning') return <AlertTriangle size={size} />
  return <Info size={size} />
}

function SeverityLabel({ severity }) {
  const labels = { critical: 'Critical', warning: 'Warning', info: 'Info' }
  return labels[severity] || severity
}

export default function NotificationPanel() {
  const { notifications, panelOpen, closePanel, dismiss, dismissAll } = useNotificationsContext()
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (!panelOpen) return
    const handler = (e) => { if (e.key === 'Escape') closePanel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [panelOpen, closePanel])

  if (!panelOpen) return null

  const sorted = [...notifications].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )

  return (
    <>
      <div
        className="fixed inset-0 z-[55]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={closePanel}
      />

      <div
        className="fixed right-0 top-0 h-full z-[60] flex flex-col"
        style={{
          width: 'min(420px, 100vw)',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        }}
      >
        <div
          className="flex items-start justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Notifications
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {notifications.length} active alert{notifications.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => setShowSettings(v => !v)}
              className="p-1 rounded hover:opacity-60 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
              title="Notification settings"
            >
              <Settings size={13} />
            </button>
            {notifications.length > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs px-2 py-1 rounded"
                style={{
                  color: 'var(--text-muted)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Dismiss all
              </button>
            )}
            <button
              onClick={closePanel}
              className="p-1 rounded hover:opacity-60 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Close notifications"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {showSettings && (
          <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <NotificationSettings />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-2"
              style={{ color: 'var(--text-muted)' }}
            >
              <Info size={36} style={{ opacity: 0.3 }} />
              <p className="text-sm">All clear!</p>
              <p className="text-xs opacity-60">No notifications right now.</p>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-2">
              {sorted.map(notif => (
                <div
                  key={notif.id}
                  className="rounded-lg p-3 flex gap-3"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${SEVERITY_COLORS[notif.severity]}`,
                  }}
                >
                  <span
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: SEVERITY_COLORS[notif.severity] }}
                  >
                    <SeverityIcon severity={notif.severity} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {notif.title}
                        </p>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            color: SEVERITY_COLORS[notif.severity],
                            background: 'transparent',
                            border: `1px solid ${SEVERITY_COLORS[notif.severity]}`,
                            fontSize: 10,
                          }}
                        >
                          <SeverityLabel severity={notif.severity} />
                        </span>
                      </div>
                      <button
                        onClick={() => dismiss(notif.id)}
                        className="flex-shrink-0 p-0.5 rounded hover:opacity-60 transition-opacity"
                        style={{ color: 'var(--text-muted)' }}
                        title="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
