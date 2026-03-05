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
  const size = 14
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
      className="fixed top-3 right-3 z-[70] flex flex-col gap-2"
      style={{ maxWidth: 320 }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="rounded-2xl px-3.5 py-2.5 flex items-start gap-2.5"
          style={{
            background: 'rgba(30, 30, 30, 0.65)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow:
              '0 8px 32px rgba(0, 0, 0, 0.35), ' +
              '0 2px 8px rgba(0, 0, 0, 0.2), ' +
              'inset 0 0.5px 0 rgba(255, 255, 255, 0.1)',
            animation: 'appleSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <span
            className="flex-shrink-0 mt-0.5 rounded-full p-1"
            style={{
              color: SEVERITY_COLORS[toast.severity],
              background: `color-mix(in srgb, ${SEVERITY_COLORS[toast.severity]} 15%, transparent)`,
            }}
          >
            <SeverityIcon severity={toast.severity} />
          </span>
          <div className="flex-1 min-w-0">
            <p
              className="font-semibold leading-snug"
              style={{ color: 'rgba(255, 255, 255, 0.95)', fontSize: 12 }}
            >
              {toast.title}
            </p>
            {toast.message && (
              <p
                className="leading-snug mt-0.5"
                style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: 11 }}
              >
                {toast.message}
              </p>
            )}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action.onClick()
                  removeToast(toast.id)
                }}
                className="font-semibold mt-1.5 hover:brightness-125 transition-all"
                style={{
                  color: SEVERITY_COLORS[toast.severity] || 'var(--accent-blue)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 rounded-full p-1 transition-all hover:bg-white/10"
            style={{ color: 'rgba(255, 255, 255, 0.4)' }}
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes appleSlideIn {
          from {
            transform: translateY(-100%) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        [data-theme="light"] .fixed.top-3.right-3 > div {
          background: rgba(255, 255, 255, 0.72) !important;
          border-color: rgba(0, 0, 0, 0.08) !important;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 2px 8px rgba(0, 0, 0, 0.06),
            inset 0 0.5px 0 rgba(255, 255, 255, 0.6) !important;
        }

        [data-theme="light"] .fixed.top-3.right-3 > div p:first-child {
          color: rgba(0, 0, 0, 0.85) !important;
        }

        [data-theme="light"] .fixed.top-3.right-3 > div p:nth-child(2) {
          color: rgba(0, 0, 0, 0.5) !important;
        }

        [data-theme="light"] .fixed.top-3.right-3 > div > button:last-child {
          color: rgba(0, 0, 0, 0.3) !important;
        }
      `}</style>
    </div>
  )
}
