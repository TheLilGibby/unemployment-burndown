import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token') || ''
  const emailFromUrl = searchParams.get('email') || ''

  const [email, setEmail] = useState(emailFromUrl)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!tokenFromUrl) {
      setError('Invalid reset link. Please request a new one.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: tokenFromUrl, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Password reset failed')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}
      >
        <div
          className="w-full max-w-sm rounded-2xl border p-8 shadow-xl text-center"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: '#10b981', opacity: 0.9 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Password Reset
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Your password has been reset successfully.
          </p>
          <Link
            to="/"
            className="inline-block rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent-blue)', color: '#fff' }}
          >
            Sign In
          </Link>
        </div>
      </div>
    )
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
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Set New Password
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="resetEmail"
              className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Email
            </label>
            <input
              id="resetEmail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="confirmNewPassword"
              className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Confirm New Password
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent-blue)', color: '#fff', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link
            to="/"
            className="text-sm hover:underline"
            style={{ color: 'var(--accent-blue)' }}
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
