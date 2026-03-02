import { AlertTriangle, X } from 'lucide-react'

export default function ImpersonationBanner({ user, onStop }) {
  return (
    <div className="sticky top-0 z-[60] flex items-center justify-between px-4 py-2 text-sm font-medium"
      style={{
        backgroundColor: '#f59e0b',
        color: '#78350f',
      }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span>
          Viewing as <strong>{user?.email || user?.userId}</strong>
        </span>
      </div>
      <button
        onClick={onStop}
        className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-colors"
        style={{ backgroundColor: '#78350f', color: '#fef3c7' }}
      >
        <X className="w-3 h-3" />
        Stop Impersonating
      </button>
    </div>
  )
}
