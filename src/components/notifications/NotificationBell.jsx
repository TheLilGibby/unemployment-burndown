import { Bell } from 'lucide-react'
import { useNotificationsContext } from '../../context/NotificationsContext'

const SEVERITY_COLORS = {
  critical: 'var(--accent-red)',
  warning: 'var(--accent-amber)',
  info: 'var(--accent-blue)',
}

export default function NotificationBell() {
  const { unreadCount, highestSeverity, togglePanel } = useNotificationsContext()

  return (
    <button
      onClick={togglePanel}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
      title={unreadCount > 0 ? `${unreadCount} notification${unreadCount !== 1 ? 's' : ''}` : 'No notifications'}
      style={{
        borderColor: 'var(--border-subtle)',
        background: 'var(--bg-input)',
        color: unreadCount > 0 ? SEVERITY_COLORS[highestSeverity] : 'var(--text-muted)',
      }}
    >
      <Bell size={12} />
      <span className="hidden sm:inline">Alerts</span>
      {unreadCount > 0 && (
        <span
          className="text-xs font-semibold px-1 rounded-full tabular-nums"
          style={{
            background: SEVERITY_COLORS[highestSeverity],
            color: '#fff',
            fontSize: '10px',
            lineHeight: '16px',
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
