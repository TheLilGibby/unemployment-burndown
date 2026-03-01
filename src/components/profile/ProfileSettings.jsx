import { useState, useEffect, useRef } from 'react'
import { PROFILE_COLORS } from './ProfileBubble'

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

export default function ProfileSettings({ user, onClose, onSave }) {
  const [selectedColor, setSelectedColor] = useState(user?.profileColor || 'blue')
  const [avatarDataUrl, setAvatarDataUrl] = useState(user?.avatarDataUrl || null)
  const [org, setOrg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user?.orgId) return
    fetch(`${API_BASE}/api/org`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setOrg(data) })
      .catch(() => {})
  }, [user?.orgId])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const compressed = await compressImage(file)
      setAvatarDataUrl(compressed)
    } catch {
      setError('Failed to process image. Please try a different file.')
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await onSave({ profileColor: selectedColor, avatarDataUrl })
    setSaving(false)
    if (result?.ok === false) {
      setError(result.error || 'Failed to save profile')
    } else {
      onClose()
    }
  }

  function handleRemoveAvatar() {
    setAvatarDataUrl(null)
  }

  const initials = user?.email ? user.email[0].toUpperCase() : '?'
  const ringColor = PROFILE_COLORS[selectedColor]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Profile
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Avatar preview */}
          <div className="flex flex-col items-center gap-3">
            <div
              style={{
                width: 72,
                height: 72,
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
                <span style={{ fontSize: 28, fontWeight: 700, color: ringColor }}>{initials}</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-input)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
              >
                {avatarDataUrl ? 'Change photo' : 'Upload photo'}
              </button>
              {avatarDataUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--accent-red)', background: 'var(--bg-input)' }}
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Account info */}
          <div className="space-y-2">
            <div
              className="rounded-xl px-3 py-2.5"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>EMAIL</div>
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.email}</div>
            </div>

            {org && (
              <div
                className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
              >
                <div>
                  <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>ORGANIZATION</div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{org.name}</div>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{
                    background: user?.orgRole === 'owner' ? 'rgba(59,130,246,0.15)' : 'rgba(156,163,175,0.15)',
                    color: user?.orgRole === 'owner' ? 'var(--accent-blue)' : 'var(--text-muted)',
                  }}
                >
                  {user?.orgRole}
                </span>
              </div>
            )}
          </div>

          {/* Outline color picker */}
          <div>
            <div className="text-xs font-medium mb-2.5" style={{ color: 'var(--text-secondary)' }}>
              Outline color
            </div>
            <div className="flex gap-2">
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
                      border: isSelected ? `2px solid var(--text-primary)` : '2px solid transparent',
                      outline: isSelected ? `2px solid ${hex}` : 'none',
                      outlineOffset: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'transform 0.1s',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
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

          {/* Error */}
          {error && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)' }}
            >
              {error}
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 rounded-xl text-sm font-medium transition-opacity"
            style={{
              background: 'var(--accent-blue)',
              color: '#fff',
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
