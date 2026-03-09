import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../../context/ToastContext'
import { validateEmail } from '../../utils/validation'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function safeJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error('API not reachable — backend may not be configured')
    }
    throw new Error(`Unexpected response (HTTP ${res.status})`)
  }
}

export default function OrgSettings({ user, onClose }) {
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const toast = useToast()

  // Invite state
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [invitesLoading, setInvitesLoading] = useState(false)

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/org`, {
        headers: { ...authHeaders() },
      })
      if (!res.ok) {
        let message = `Failed to load organization (HTTP ${res.status})`
        try {
          const errData = await res.json()
          message = errData.error || errData.message || message
        } catch {
          // Could not parse error response body
        }
        throw new Error(message)
      }
      const data = await safeJson(res)
      setOrg(data)
      setLoading(false)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }, [])

  const fetchInvites = useCallback(async () => {
    if (user?.orgRole !== 'owner') return
    setInvitesLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/org/invites`, {
        headers: { ...authHeaders() },
      })
      if (res.ok) {
        const data = await safeJson(res)
        setInvites(data.invites || [])
      }
    } catch {
      // Silently fail — invites are supplementary
    }
    setInvitesLoading(false)
  }, [user?.orgRole])

  useEffect(() => { fetchOrg() }, [fetchOrg])
  useEffect(() => { fetchInvites() }, [fetchInvites])

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function handleRegenerateCode() {
    setRegenerating(true)
    try {
      const res = await fetch(`${API_BASE}/api/org/regenerate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      })
      if (!res.ok) {
        let message = 'Failed to regenerate code'
        try {
          const errData = await res.json()
          message = errData.error || errData.message || message
        } catch { /* ignore parse errors */ }
        throw new Error(message)
      }
      const data = await safeJson(res)
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
      toast.success('Copied!', 'Join code copied to clipboard.')
    }
  }

  async function handleSendInvite(e) {
    e.preventDefault()
    setInviteError(null)
    const emailErr = validateEmail(inviteEmail)
    if (emailErr) {
      setInviteError(emailErr)
      return
    }

    setInviteSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/org/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || 'Failed to send invite')

      setInviteEmail('')
      toast.success('Invite sent!', `Invitation sent to ${inviteEmail.trim()}`)
      fetchInvites()
    } catch (e) {
      setInviteError(e.message)
    }
    setInviteSending(false)
  }

  async function handleRevokeInvite(inviteId) {
    try {
      const res = await fetch(`${API_BASE}/api/org/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      })
      if (!res.ok) {
        const data = await safeJson(res)
        throw new Error(data.error || 'Failed to revoke')
      }
      setInvites(prev => prev.filter(inv => inv.inviteId !== inviteId))
      toast.success('Revoked', 'Invite has been revoked.')
    } catch (e) {
      setInviteError(e.message)
    }
  }

  const isOwner = user?.orgRole === 'owner'
  const pendingInvites = invites.filter(inv => inv.status === 'pending' && !inv.expired)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
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

        <div className="p-6 space-y-5 overflow-y-auto">
          {loading && (
            <div className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          )}

          {error && (
            <div
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              <p>{error}</p>
              {(error.includes('membership required') || error.includes('expired') || error.includes('Authentication')) && (
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Try signing out and back in to refresh your session.
                </p>
              )}
              <button
                onClick={() => { setError(null); setLoading(true); fetchOrg() }}
                className="mt-2 text-xs px-2.5 py-1 rounded border transition-colors"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                Retry
              </button>
            </div>
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

              {/* Invite Members Section */}
              {isOwner && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                    Invite Members
                  </div>
                  <form onSubmit={handleSendInvite} className="flex gap-2 mb-3">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                      className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{
                        background: 'var(--bg-input)',
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={inviteSending}
                      className="px-3 py-2 text-xs rounded-lg font-medium whitespace-nowrap"
                      style={{ background: 'var(--accent-blue)', color: '#fff', opacity: inviteSending ? 0.6 : 1 }}
                    >
                      {inviteSending ? 'Sending...' : 'Send Invite'}
                    </button>
                  </form>

                  {inviteError && (
                    <p
                      className="text-xs rounded-lg px-3 py-2 mb-3"
                      style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)' }}
                    >
                      {inviteError}
                    </p>
                  )}

                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Invited users will receive an email with a link to sign up. They must set up phone-based 2FA during registration.
                  </p>

                  {/* Pending Invites List */}
                  {pendingInvites.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                        Pending Invites ({pendingInvites.length})
                      </div>
                      {pendingInvites.map(inv => (
                        <div
                          key={inv.inviteId}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg"
                          style={{ background: 'var(--bg-input)' }}
                        >
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: 'var(--accent-amber, #f59e0b)' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                              <polyline points="22,6 12,13 2,6" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {inv.email}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              Expires {new Date(inv.expiresAt).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevokeInvite(inv.inviteId)}
                            className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded hover:opacity-80"
                            style={{
                              background: 'rgba(248,113,113,0.1)',
                              color: 'var(--accent-red)',
                            }}
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {invitesLoading && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading invites...</p>
                  )}
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
