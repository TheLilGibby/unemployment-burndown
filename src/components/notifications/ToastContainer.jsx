import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { useNotificationsContext } from '../../context/NotificationsContext'

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

export default function ToastContainer() {
  const { toasts, removeToast, openPanel } = useNotificationsContext()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2"
      style={{ maxWidth: 360 }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="rounded-lg p-3 flex gap-3 shadow-lg cursor-pointer"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderLeft: `3px solid ${SEVERITY_COLORS[toast.severity]}`,
            animation: 'slideInRight 0.3s ease-out',
          }}
          onClick={() => {
            removeToast(toast.id)
            openPanel()
          }}
        >
          <span
            className="flex-shrink-0 mt-0.5"
            style={{ color: SEVERITY_COLORS[toast.severity] }}
          >
            <SeverityIcon severity={toast.severity} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {toast.title}
            </p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {toast.message}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeToast(toast.id)
            }}
            className="flex-shrink-0 p-0.5 rounded hover:opacity-60 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
