import { useNotificationsContext } from '../../context/NotificationsContext'

const SNOOZE_OPTIONS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
]

export default function NotificationSettings() {
  const { preferences, updatePreferences, updateThreshold, snooze, unsnooze } = useNotificationsContext()

  const isMuted = preferences.mutedUntil && new Date(preferences.mutedUntil) > new Date()

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          Notifications enabled
        </span>
        <button
          onClick={() => updatePreferences({ enabled: !preferences.enabled })}
          className="relative w-8 h-4 rounded-full transition-colors"
          style={{
            background: preferences.enabled ? 'var(--accent-emerald)' : 'var(--border-default)',
          }}
        >
          <span
            className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
            style={{ left: preferences.enabled ? 16 : 2 }}
          />
        </button>
      </div>

      {preferences.enabled && (
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Thresholds</p>

            <label className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Critical runway (months)</span>
              <input
                type="number"
                min={1}
                max={12}
                value={preferences.thresholds.runwayCritical}
                onChange={e => updateThreshold('runwayCritical', Number(e.target.value) || 3)}
                className="w-14 text-xs text-right px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Warning runway (months)</span>
              <input
                type="number"
                min={1}
                max={24}
                value={preferences.thresholds.runwayWarning}
                onChange={e => updateThreshold('runwayWarning', Number(e.target.value) || 6)}
                className="w-14 text-xs text-right px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Benefit expiry warning (days)</span>
              <input
                type="number"
                min={7}
                max={90}
                value={preferences.thresholds.benefitEndDays}
                onChange={e => updateThreshold('benefitEndDays', Number(e.target.value) || 30)}
                className="w-14 text-xs text-right px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Snooze</p>
            {isMuted ? (
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Muted until {new Date(preferences.mutedUntil).toLocaleString()}
                </span>
                <button
                  onClick={unsnooze}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    color: 'var(--accent-blue)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Unmute
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                {SNOOZE_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => snooze(opt.ms)}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      color: 'var(--text-muted)',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
