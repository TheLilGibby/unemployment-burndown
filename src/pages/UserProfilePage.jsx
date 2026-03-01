import { User, Mail, Building2, Shield, Key, Bell, BellOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNotificationsContext } from '../context/NotificationsContext'

const SNOOZE_OPTIONS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
]

export default function UserProfilePage() {
  const { user, logout } = useAuth()
  const { preferences, updatePreferences, updateThreshold, snooze, unsnooze } = useNotificationsContext()
  const isMuted = preferences.mutedUntil && new Date(preferences.mutedUntil) > new Date()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        {/* User Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Information
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</div>
                <div className="text-gray-900 dark:text-white">{user.email}</div>
              </div>
            </div>

            {user.name && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</div>
                  <div className="text-gray-900 dark:text-white">{user.name}</div>
                </div>
              </div>
            )}

            {user.organizationId && (
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Organization</div>
                  <div className="text-gray-900 dark:text-white">{user.organizationName || user.organizationId}</div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Status</div>
                <div className="text-gray-900 dark:text-white">
                  {user.mfaEnabled ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
                      <Shield className="w-3 h-3" />
                      MFA Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-md text-sm">
                      MFA Not Enabled
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" />
            Security
          </h2>
          
          <div className="space-y-3">
            <button
              onClick={() => {/* TODO: Navigate to MFA setup */}}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white">
                {user.mfaEnabled ? 'Manage MFA' : 'Enable Two-Factor Authentication'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {user.mfaEnabled ? 'Update or disable MFA settings' : 'Add an extra layer of security to your account'}
              </div>
            </button>

            <button
              onClick={() => {/* TODO: Change password flow */}}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="font-medium text-gray-900 dark:text-white">Change Password</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Update your account password</div>
            </button>
          </div>
        </div>


        {/* Notification Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>

          <div className="space-y-5">
            {/* Enable/disable toggle */}
            <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Enable notifications</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Receive alerts about runway, benefits, and balance milestones</div>
              </div>
              <button
                onClick={() => updatePreferences({ enabled: !preferences.enabled })}
                className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                style={{ background: preferences.enabled ? '#10b981' : '#d1d5db' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
                  style={{ left: preferences.enabled ? 22 : 2 }}
                />
              </button>
            </div>

            {preferences.enabled && (
              <>
                {/* Thresholds */}
                <div className="px-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Alert Thresholds</h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Critical runway</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">(months)</span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={preferences.thresholds.runwayCritical}
                        onChange={e => updateThreshold('runwayCritical', Number(e.target.value) || 3)}
                        className="w-16 text-sm text-right px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Warning runway</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">(months)</span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={preferences.thresholds.runwayWarning}
                        onChange={e => updateThreshold('runwayWarning', Number(e.target.value) || 6)}
                        className="w-16 text-sm text-right px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">Benefit expiry warning</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">(days)</span>
                      </div>
                      <input
                        type="number"
                        min={7}
                        max={90}
                        value={preferences.thresholds.benefitEndDays}
                        onChange={e => updateThreshold('benefitEndDays', Number(e.target.value) || 30)}
                        className="w-16 text-sm text-right px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                  </div>
                </div>

                {/* Snooze */}
                <div className="px-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Snooze</h3>
                  {isMuted ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <BellOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">
                        Muted until {new Date(preferences.mutedUntil).toLocaleString()}
                      </span>
                      <button
                        onClick={unsnooze}
                        className="text-sm px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      >
                        Unmute
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {SNOOZE_OPTIONS.map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => snooze(opt.ms)}
                          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
        </div>

        {/* Sign Out */}
        <div className="flex justify-end">
          <button
            onClick={logout}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
