import { User, Mail, Building2, Shield, Key, Bell, Palette } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function UserProfilePage() {
  const { user, logout } = useAuth()

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
            Profile
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

        {/* Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Preferences
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Theme</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Use the theme toggle in the header</div>
              </div>
              <Palette className="w-5 h-5 text-gray-400" />
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Notifications</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Manage notification preferences</div>
              </div>
              <Bell className="w-5 h-5 text-gray-400" />
            </div>
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
