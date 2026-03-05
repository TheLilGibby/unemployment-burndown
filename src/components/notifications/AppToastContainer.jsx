import { X, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

const SEVERITY_COLORS = {
  critical: 'var(--accent-red)',
  error:    'var(--accent-red)',
  warning:  'var(--accent-amber)',
  success:  'var(--accent-emerald)',
  info:     'var(--accent-blue)',
}

function SeverityIcon({ severity }) {
  const size = 13
  if (severity === 'critical' || severity === 'error') return <AlertCircle size={size} />
  if (severity === 'warning') return <AlertTriangle size={size} />
  if (severity === 'success') return <CheckCircle2 size={size} />
  return <Info size={size} />
}

export default function AppToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-3 right-3 z-[70] flex flex-col gap-1.5"
      style={{ maxWidth: 280 }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="rounded-md px-2.5 py-2 flex items-start gap-2"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            animation: 'slideInRight 0.2s ease-out',
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
            {toast.message && (
              <p className="text-xs leading-snug mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {toast.message}
              </p>
            )}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action.onClick()
                  removeToast(toast.id)
                }}
                className="text-xs font-semibold mt-1 hover:underline"
                style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
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
