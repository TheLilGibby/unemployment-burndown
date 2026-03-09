import { useState, useEffect, useRef } from 'react'
import { User, Mail, Building2, Shield, Key, Bell, BellOff, Trash2, AlertTriangle, Sun, Moon, Monitor, EyeOff, Briefcase, Palette, Camera, MapPin, Download, Table, FileText, Package, Database, CreditCard, TrendingUp, DollarSign } from 'lucide-react'
import {
  exportBurndownCSV,
  exportExpensesCSV,
  exportSavingsCSV,
  exportScenariosCSV,
  exportTransactionsCSV,
  exportIncomeCSV,
  exportCreditCardsCSV,
  exportInvestmentsCSV,
  exportAllData,
  exportSummaryJSON,
  exportFullBackupJSON,
} from '../utils/export'
import { Link } from 'react-router-dom'
import { validateAvatarFile } from '../utils/validation'
import { useAuth } from '../hooks/useAuth'
import { useNotificationsContext } from '../context/NotificationsContext'
import { useTheme } from '../context/ThemeContext'
import { useHiddenMode } from '../context/HiddenModeContext'
import { PROFILE_COLORS } from '../components/profile/ProfileBubble'
import MfaSetup from '../components/auth/MfaSetup'
import AlertSettings from '../components/notifications/AlertSettings'
import PropertyLocationSettings from '../components/settings/PropertyLocationSettings'
import JobsPanel from '../components/finances/JobsPanel'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const COLOR_KEYS = Object.keys(PROFILE_COLORS)

async function compressImage(file, maxPx = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const SNOOZE_OPTIONS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
]

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'account', label: 'Account', icon: Key },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'properties', label: 'Properties', icon: MapPin },
  { id: 'jobs', label: 'Job History', icon: Briefcase },
  { id: 'data', label: 'Data', icon: Download },
]

export default function UserProfilePage({ user: userProp, updateProfile, jobs = [], onJobsChange, people = [], allTransactions = [], transactionOverrides = {}, properties = [], onPropertiesChange, exportData }) {
  const { user: authUser, logout, deleteAccount } = useAuth()
  const user = userProp || authUser
  const [activeSection, setActiveSection] = useState('profile')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { preferences, onPreferencesChange, updatePreferences, updateThreshold, snooze, unsnooze } = useNotificationsContext()
  const { theme, setTheme } = useTheme()
  const { hidden, toggleHidden } = useHiddenMode()
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled || false)
  const isMuted = preferences.mutedUntil && new Date(preferences.mutedUntil) > new Date()

  // Profile state
  const [selectedColor, setSelectedColor] = useState(user?.profileColor || 'blue')
  const [avatarDataUrl, setAvatarDataUrl] = useState(user?.avatarDataUrl || null)
  const [org, setOrg] = useState(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const fileInputRef = useRef(null)
  const isScrollingProgrammatically = useRef(false)
  const scrollTimeoutRef = useRef(null)

  useEffect(() => {
    function handleScroll() {
      if (isScrollingProgrammatically.current) return
      const ids = NAV_ITEMS
        .filter(item => (item.id !== 'jobs' || onJobsChange) && (item.id !== 'properties' || onPropertiesChange))
        .map(item => item.id)
      let active = ids[0]
      for (const id of ids) {
        const el = document.getElementById(`section-${id}`)
        if (!el) continue
        const { top } = el.getBoundingClientRect()
        if (top <= 120) active = id
      }
      setActiveSection(active)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeoutRef.current)
    }
  }, [onJobsChange, onPropertiesChange])

  useEffect(() => {
    if (!user?.orgId) return
    fetch(`${API_BASE}/api/org`, { headers: authHeaders() })
      .then(async r => {
        if (!r.ok) return null
        const text = await r.text()
        try { return JSON.parse(text) } catch { return null }
      })
      .then(data => { if (data) setOrg(data) })
      .catch(() => {})
  }, [user?.orgId])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileError(null)
    const fileErr = validateAvatarFile(file)
    if (fileErr) {
      setProfileError(fileErr)
      return
    }
    try {
      const compressed = await compressImage(file)
      setAvatarDataUrl(compressed)
    } catch {
      setProfileError('Failed to process image. Please try a different file.')
    }
  }

  async function handleProfileSave() {
    if (!updateProfile) return
    setProfileSaving(true)
    setProfileError(null)
    setProfileSuccess(false)
    const result = await updateProfile({ profileColor: selectedColor, avatarDataUrl })
    setProfileSaving(false)
    if (result?.ok === false) {
      setProfileError(result.error || 'Failed to save profile')
    } else {
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  const initials = user?.email ? user.email[0].toUpperCase() : '?'
  const ringColor = PROFILE_COLORS[selectedColor]

  const sectionRefs = {}

  return (
    <div className="min-h-screen py-6 sm:py-10" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar nav */}
          <nav className="lg:w-56 flex-shrink-0">
            <div className="lg:sticky lg:top-16">
              <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                {NAV_ITEMS.filter(item => (item.id !== 'jobs' || onJobsChange) && (item.id !== 'properties' || onPropertiesChange)).map(item => {
                  const Icon = item.icon
                  const isActive = activeSection === item.id
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          setActiveSection(item.id)
                          isScrollingProgrammatically.current = true
                          document.getElementById(`section-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          clearTimeout(scrollTimeoutRef.current)
                          scrollTimeoutRef.current = setTimeout(() => {
                            isScrollingProgrammatically.current = false
                          }, 1000)
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                        }`}
                        style={isActive ? { borderLeft: '2px solid var(--accent-blue, #3b82f6)' } : { borderLeft: '2px solid transparent' }}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {item.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </nav>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-14">

            {/* ── Profile ── */}
            <section id="section-profile">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white pt-2 pb-2 mb-6" style={{ borderBottom: '1px solid var(--border-subtle, #d1d5db)' }}>
                Profile
              </h2>

              <div className="flex flex-col sm:flex-row gap-6">
                {/* Avatar column */}
                <div className="flex flex-col items-center gap-3 sm:w-48 flex-shrink-0">
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: '50%',
                      border: `3px solid ${ringColor}`,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: ringColor + '22',
                      flexShrink: 0,
                    }}
                  >
                    {avatarDataUrl ? (
                      <img src={avatarDataUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 36, fontWeight: 700, color: ringColor }}>{initials}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs px-3 py-1.5 rounded-md border transition-colors font-medium"
                      style={{ borderColor: 'var(--border-default, #d1d5db)', color: 'var(--text-secondary)', background: 'var(--bg-input, #fff)' }}
                    >
                      <Camera className="w-3 h-3 inline mr-1" />
                      {avatarDataUrl ? 'Change' : 'Upload'}
                    </button>
                    {avatarDataUrl && (
                      <button
                        onClick={() => setAvatarDataUrl(null)}
                        className="text-xs px-3 py-1.5 rounded-md border transition-colors"
                        style={{ borderColor: 'var(--border-default, #d1d5db)', color: '#ef4444' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>

                {/* Info column */}
                <div className="flex-1 space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</label>
                    <div className="px-3 py-2 rounded-md text-sm text-gray-900 dark:text-white" style={{ background: 'var(--bg-input, #f3f4f6)', border: '1px solid var(--border-subtle, #e5e7eb)' }}>
                      {user.email}
                    </div>
                  </div>

                  {/* Name */}
                  {user.name && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                      <div className="px-3 py-2 rounded-md text-sm text-gray-900 dark:text-white" style={{ background: 'var(--bg-input, #f3f4f6)', border: '1px solid var(--border-subtle, #e5e7eb)' }}>
                        {user.name}
                      </div>
                    </div>
                  )}

                  {/* Organization */}
                  {(org || user.organizationId) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Organization</label>
                      <div className="flex items-center justify-between px-3 py-2 rounded-md text-sm" style={{ background: 'var(--bg-input, #f3f4f6)', border: '1px solid var(--border-subtle, #e5e7eb)' }}>
                        <span className="text-gray-900 dark:text-white">{org?.name || user.organizationName || user.organizationId}</span>
                        {user.orgRole && (
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
                            style={{
                              background: user.orgRole === 'owner' ? 'rgba(59,130,246,0.15)' : 'rgba(156,163,175,0.15)',
                              color: user.orgRole === 'owner' ? '#3b82f6' : '#9ca3af',
                            }}
                          >
                            {user.orgRole}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Outline color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Profile color</label>
                    <div className="flex gap-2.5">
                      {COLOR_KEYS.map(key => {
                        const hex = PROFILE_COLORS[key]
                        const isSelected = selectedColor === key
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedColor(key)}
                            title={key}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: hex,
                              border: isSelected ? '2px solid var(--text-primary, #111)' : '2px solid transparent',
                              outline: isSelected ? `2px solid ${hex}` : 'none',
                              outlineOffset: 1,
                              cursor: 'pointer',
                              transition: 'transform 0.1s',
                              transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Profile save */}
                  {profileError && (
                    <div className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(248,113,113,0.1)', color: '#ef4444' }}>
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="text-xs px-3 py-2 rounded-md" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                      Profile updated successfully.
                    </div>
                  )}
                  {updateProfile && (
                    <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle, #e5e7eb)' }}>
                      <button
                        onClick={handleProfileSave}
                        disabled={profileSaving}
                        className="px-4 py-2 rounded-md text-sm font-medium text-white transition-opacity"
                        style={{
                          background: '#2da44e',
                          opacity: profileSaving ? 0.6 : 1,
                          cursor: profileSaving ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {profileSaving ? 'Saving...' : 'Update profile'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Account (Security) ── */}
            <section id="section-account">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white pt-2 pb-2 mb-6" style={{ borderBottom: '1px solid var(--border-subtle, #d1d5db)' }}>
                Account
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Password</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Update your account password</div>
                  </div>
                  <button
                    onClick={() => {/* TODO: Change password flow */}}
                    className="px-3 py-1.5 text-sm rounded-md border font-medium transition-colors"
                    style={{ borderColor: 'var(--border-default, #d1d5db)', color: 'var(--text-secondary)' }}
                  >
                    Change password
                  </button>
                </div>

                <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Two-factor authentication</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {user.mfaEnabled ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <Shield className="w-3 h-3" /> Enabled
                        </span>
                      ) : 'Not enabled'}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <MfaSetup mfaEnabled={mfaEnabled} onMfaChange={setMfaEnabled} />
                  </div>
                </div>

                <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <EyeOff className="w-4 h-4" /> Hidden mode
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Blur financial numbers for screen sharing
                    </div>
                  </div>
                  <button
                    onClick={toggleHidden}
                    className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                    style={{ background: hidden ? '#10b981' : '#d1d5db' }}
                  >
                    <span
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
                      style={{ left: hidden ? 22 : 2 }}
                    />
                  </button>
                </div>

                {hidden && (
                  <p className="text-xs text-emerald-500 dark:text-emerald-400">
                    Hidden mode is active — all financial figures are blurred.
                  </p>
                )}
              </div>
            </section>

            {/* ── Appearance ── */}
            <section id="section-appearance">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white pt-2 pb-2 mb-6" style={{ borderBottom: '1px solid var(--border-subtle, #d1d5db)' }}>
                Appearance
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme preference</label>
                <div className="flex gap-3">
                  {[
                    { value: 'light', label: 'Light', Icon: Sun },
                    { value: 'dark', label: 'Dark', Icon: Moon },
                    { value: 'system', label: 'System', Icon: Monitor },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border transition-colors ${
                        theme === opt.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <opt.Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Notifications ── */}
            <section id="section-notifications">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white pt-2 pb-2 mb-6" style={{ borderBottom: '1px solid var(--border-subtle, #d1d5db)' }}>
                Notifications
              </h2>

              <div className="space-y-5">
                <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Enable notifications</div>
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
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Alert thresholds</h3>
                      <div className="space-y-3">
                        {[
                          { label: 'Critical runway', unit: 'months', key: 'runwayCritical', min: 1, max: 12, fallback: 3 },
                          { label: 'Warning runway', unit: 'months', key: 'runwayWarning', min: 1, max: 24, fallback: 6 },
                          { label: 'Benefit expiry warning', unit: 'days', key: 'benefitEndDays', min: 7, max: 90, fallback: 30 },
                        ].map(t => (
                          <div key={t.key} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
                            <div>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{t.label}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({t.unit})</span>
                            </div>
                            <input
                              type="number"
                              min={t.min}
                              max={t.max}
                              value={preferences.thresholds[t.key]}
                              onChange={e => updateThreshold(t.key, Number(e.target.value) || t.fallback)}
                              className="w-16 text-sm text-right px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Snooze */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Snooze</h3>
                      {isMuted ? (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
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

                    {/* Push alerts */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Push alerts & spending limits</h3>
                      <AlertSettings
                        preferences={preferences}
                        onPreferencesChange={onPreferencesChange}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ── Properties ── */}
            {onPropertiesChange && (
              <section id="section-properties">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white pb-2 mb-6" style={{ borderBottom: '1px solid var(--border-subtle, #d1d5db)' }}>
                  Property Locations
                </h2>
                <PropertyLocationSettings properties={properties} onChange={onPropertiesChange} />
              </section>
            )}

            {/* ── Job History ── */}
            {onJobsChange && (
              <section id="section-jobs">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white pt-2 pb-2 mb-6" style={{ borderBottom: '1px solid var(--border-subtle, #d1d5db)' }}>
                  Job History
                </h2>
                <JobsPanel
                  jobs={jobs}
                  onChange={onJobsChange}
                  people={people}
                  allTransactions={allTransactions}
                  transactionOverrides={transactionOverrides}
                />
              </section>
            )}

            {/* ── Data ── */}
            {exportData && (
              <section id="section-data">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white pt-2 pb-2 mb-6" style={{ borderBottom: '1px solid var(--border-subtle, #d1d5db)' }}>
                  Data Management
                </h2>
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Export your financial data in various formats for offline use or analysis.
                  </p>
                  {[
                    { label: 'Burndown Timeline CSV', icon: Table, onClick: () => exportBurndownCSV(exportData.burndown), disabled: !exportData.burndown?.timeline?.length },
                    { label: 'Expenses CSV', icon: Table, onClick: () => exportExpensesCSV(exportData.expenses), disabled: !exportData.expenses?.length },
                    { label: 'Savings Accounts CSV', icon: Table, onClick: () => exportSavingsCSV(exportData.savingsAccounts), disabled: !exportData.savingsAccounts?.length },
                    { label: 'Scenarios CSV', icon: Table, onClick: () => exportScenariosCSV(exportData.scenarios, exportData.scenarioResults), disabled: !exportData.scenarios?.length },
                    { label: 'Credit Cards CSV', icon: CreditCard, onClick: () => exportCreditCardsCSV(exportData.creditCards), disabled: !exportData.creditCards?.length },
                    { label: 'Income Sources CSV', icon: DollarSign, onClick: () => exportIncomeCSV(exportData.monthlyIncome), disabled: !exportData.monthlyIncome?.length },
                    { label: 'Investments CSV', icon: TrendingUp, onClick: () => exportInvestmentsCSV(exportData.investments), disabled: !exportData.investments?.length },
                    { label: 'Transactions CSV', icon: Table, onClick: () => exportTransactionsCSV(exportData.transactions), disabled: !exportData.transactions?.length },
                  ].map(({ label, icon: Icon, onClick, disabled }) => (
                    <div key={label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                      </div>
                      <button
                        onClick={() => { try { onClick() } catch (e) { alert(`Export failed: ${e.message}`) } }}
                        disabled={disabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderColor: 'var(--border-default, #d1d5db)', color: 'var(--text-secondary)', background: 'var(--bg-input, #fff)' }}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
                    <div className="flex items-center gap-2.5">
                      <Package className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">Export All (CSV Bundle)</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Downloads all datasets as a ZIP archive</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { try { exportAllData(exportData) } catch (e) { alert(`Export failed: ${e.message}`) } }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border font-medium transition-colors"
                      style={{ borderColor: 'var(--border-default, #d1d5db)', color: 'var(--text-secondary)', background: 'var(--bg-input, #fff)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">Summary JSON</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Full financial snapshot as structured JSON</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          exportSummaryJSON({
                            ...exportData,
                            monthlyExpenses: exportData.burndown?.current?.effectiveExpenses,
                            monthlyIncome: exportData.burndown?.current?.monthlyBenefits,
                            runwayMonths: exportData.burndown?.current?.totalRunwayMonths,
                            runoutDate: exportData.burndown?.current?.runoutDate,
                          })
                        } catch (e) { alert(`Export failed: ${e.message}`) }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border font-medium transition-colors"
                      style={{ borderColor: 'var(--border-default, #d1d5db)', color: 'var(--text-secondary)', background: 'var(--bg-input, #fff)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2.5">
                      <Database className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">Full Data Backup</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Complete application state as JSON backup</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { try { exportFullBackupJSON(exportData) } catch (e) { alert(`Export failed: ${e.message}`) } }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border font-medium transition-colors"
                      style={{ borderColor: 'var(--border-default, #d1d5db)', color: 'var(--text-secondary)', background: 'var(--bg-input, #fff)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Privacy link */}
            <section>
              <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle, #e5e7eb)' }}>
                <Link
                  to="/privacy"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Privacy Policy
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
