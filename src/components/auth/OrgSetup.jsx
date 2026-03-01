import { useState } from 'react'

export default function OrgSetup({ onCreateOrg, onJoinOrg, onLogout, error }) {
  const [mode, setMode] = useState(null) // null | 'create' | 'join'
  const [orgName, setOrgName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState(null)

  const displayError = error || localError

  async function handleCreate(e) {
    e.preventDefault()
    setLocalError(null)
    if (!orgName.trim()) { setLocalError('Organization name is required'); return }
    setSubmitting(true)
    const result = await onCreateOrg(orgName.trim())
    if (!result) setSubmitting(false)
  }

  async function handleJoin(e) {
    e.preventDefault()
    setLocalError(null)
    if (!joinCode.trim()) { setLocalError('Join code is required'); return }
    setSubmitting(true)
    const result = await onJoinOrg(joinCode.trim())
    if (!result) setSubmitting(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8 shadow-xl"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div className="mb-6 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'var(--accent-blue)', opacity: 0.9 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Set Up Your Household
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Create a new household or join an existing one
          </p>
        </div>

        {!mode && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}
            >
              Create New Household
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-90 border"
              style={{ background: 'transparent', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
            >
              Join Existing Household
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="orgName"
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Household Name
              </label>
              <input
                id="orgName"
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Smith Family"
                required
                autoFocus
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {displayError && (
              <p
                className="text-sm rounded-lg px-3 py-2"
                style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)' }}
              >
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-blue)', color: '#fff', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Creating...' : 'Create Household'}
            </button>

            <button
              type="button"
              onClick={() => { setMode(null); setLocalError(null) }}
              className="w-full text-sm py-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label
                htmlFor="joinCode"
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Join Code
              </label>
              <input
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
                required
                autoFocus
                className="w-full rounded-lg border px-3 py-2.5 text-sm font-mono tracking-widest text-center outline-none transition-colors focus:ring-1"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Ask your household owner for the join code
              </p>
            </div>

            {displayError && (
              <p
                className="text-sm rounded-lg px-3 py-2"
                style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)' }}
              >
                {displayError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-blue)', color: '#fff', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Joining...' : 'Join Household'}
            </button>

            <button
              type="button"
              onClick={() => { setMode(null); setLocalError(null) }}
              className="w-full text-sm py-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Back
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onLogout}
            className="text-sm hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
