export const PROFILE_COLORS = {
  blue:    '#3b82f6',
  purple:  '#8b5cf6',
  emerald: '#34d399',
  amber:   '#fbbf24',
  rose:    '#f43f5e',
  cyan:    '#22d3ee',
}

export default function ProfileBubble({ user, onClick }) {
  const initials = user?.email ? user.email[0].toUpperCase() : '?'
  const ringColor = PROFILE_COLORS[user?.profileColor] || PROFILE_COLORS.blue
  const avatar = user?.avatarDataUrl

  return (
    <button
      onClick={onClick}
      title="Profile settings"
      style={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        border: `2px solid ${ringColor}`,
        padding: 0,
        background: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt="Profile"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: ringColor + '22',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: ringColor,
            userSelect: 'none',
          }}
        >
          {initials}
        </div>
      )}
    </button>
  )
}
