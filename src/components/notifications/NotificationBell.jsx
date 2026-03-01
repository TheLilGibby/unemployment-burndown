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
      className="relative flex items-center justify-center rounded transition-colors hover:opacity-80"
      title={unreadCount > 0 ? `${unreadCount} notification${unreadCount !== 1 ? 's' : ''}` : 'No notifications'}
      style={{
        color: 'var(--text-muted)',
        width: 28,
        height: 28,
      }}
    >
      <Bell size={15} />
      {unreadCount > 0 && (
        <span
          className="absolute rounded-full"
          style={{
            top: 4,
            right: 4,
            width: 7,
            height: 7,
            background: SEVERITY_COLORS[highestSeverity],
            boxShadow: `0 0 0 2px var(--header-bg, var(--bg-card))`,
          }}
        />
      )}
    </button>
  )
}
