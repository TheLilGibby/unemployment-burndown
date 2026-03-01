import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function OrgSettings({ user, onClose }) {
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/org`, {
        headers: { ...authHeaders() },
      })
      if (!res.ok) throw new Error('Failed to load organization')
      const data = await res.json()
      setOrg(data)
      setLoading(false)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrg() }, [fetchOrg])

  async function handleRegenerateCode() {
    setRegenerating(true)
    try {
      const res = await fetch(`${API_BASE}/api/org/regenerate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      })
      if (!res.ok) throw new Error('Failed to regenerate code')
      const data = await res.json()
      setOrg(prev => ({ ...prev, joinCode: data.joinCode }))
    } catch (e) {
      setError(e.message)
    }
    setRegenerating(false)
  }

  function handleCopy() {
    if (org?.joinCode) {
      navigator.clipboard.writeText(org.joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isOwner = user?.orgRole === 'owner'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Household Settings</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading && (
            <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          )}

          {error && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              {error}
            </p>
          )}

          {org && (
            <>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                  Household Name
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {org.name}
                </div>
              </div>

              {isOwner && org.joinCode && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
                    Join Code
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className="text-lg font-mono tracking-[0.3em] px-3 py-1.5 rounded-lg border"
                      style={{ background: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                      {org.joinCode}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleRegenerateCode}
                      disabled={regenerating}
                      className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)', opacity: regenerating ? 0.5 : 1 }}
                    >
                      {regenerating ? '...' : 'Regenerate'}
                    </button>
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Share this code with household members so they can join
                  </p>
                </div>
              )}

              <div>
                <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                  Members ({org.members?.length || 0})
                </div>
                <div className="space-y-2">
                  {(org.members || []).map(m => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-input)' }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: m.role === 'owner' ? 'var(--accent-blue)' : 'var(--accent-purple, #8b5cf6)' }}
                      >
                        {(m.email || m.userId).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                          {m.email || m.userId}
                          {m.userId === user?.userId && (
                            <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>(you)</span>
                          )}
                        </div>
                      </div>
                      <span
                        className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded"
                        style={{
                          background: m.role === 'owner' ? 'rgba(59,130,246,0.1)' : 'rgba(139,92,246,0.1)',
                          color: m.role === 'owner' ? 'var(--accent-blue)' : 'var(--accent-purple, #8b5cf6)',
                        }}
                      >
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
