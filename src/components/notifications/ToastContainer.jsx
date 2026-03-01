import { X, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { useNotificationsContext } from '../../context/NotificationsContext'

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

export default function ToastContainer() {
  const { toasts, removeToast, openPanel } = useNotificationsContext()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-3 right-3 z-[70] flex flex-col gap-1.5"
      style={{ maxWidth: 280 }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="rounded-md px-2.5 py-2 flex items-start gap-2 cursor-pointer"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            animation: 'slideInRight 0.2s ease-out',
          }}
          onClick={() => {
            removeToast(toast.id)
            openPanel()
          }}
        >
          <span
            className="flex-shrink-0 mt-px"
            style={{ color: SEVERITY_COLORS[toast.severity] }}
          >
            <SeverityIcon severity={toast.severity} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)', fontSize: 11 }}>
              {toast.title}
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
            <X size={11} />
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
