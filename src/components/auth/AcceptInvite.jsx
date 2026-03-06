import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

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

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('token')

  const [step, setStep] = useState('validating') // validating | register | phone-verify | success | error
  const [inviteInfo, setInviteInfo] = useState(null)
  const [error, setError] = useState(null)

  // Registration fields
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // OTP fields
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpSending, setOtpSending] = useState(false)

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) {
      setError('No invite token provided')
      setStep('error')
      return
    }

    fetch(`${API_BASE}/api/org/invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then(async res => {
        const data = await safeJson(res)
        if (!res.ok) throw new Error(data.error || 'Invalid invite')
        setInviteInfo(data)
        setStep('register')
      })
      .catch(e => {
        setError(e.message)
        setStep('error')
      })
  }, [inviteToken])

  async function handleRegister(e) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (!phoneNumber.startsWith('+')) {
      setError('Phone number must start with + (e.g. +15551234567)')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteInfo.email,
          password,
          inviteToken,
          phoneNumber,
        }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      // Store token for subsequent API calls
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setStep('phone-verify')

      // Auto-send OTP
      await sendOtp(data.token)
    } catch (e) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  async function sendOtp(tokenOverride) {
    setOtpSending(true)
    setError(null)
    try {
      const token = tokenOverride || sessionStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_BASE}/api/auth/send-phone-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || 'Failed to send code')
      setOtpSent(true)
    } catch (e) {
      setError(e.message)
    }
    setOtpSending(false)
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const token = sessionStorage.getItem(TOKEN_KEY)
      const res = await fetch(`${API_BASE}/api/auth/verify-phone-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: otpCode }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || 'Verification failed')

      // Store the new token (has org info now)
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setStep('success')
    } catch (e) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  const cardStyle = {
    background: 'var(--bg-card)',
    borderColor: 'var(--border-default)',
  }
  const inputStyle = {
    background: 'var(--bg-input)',
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}
    >
      <div className="w-full max-w-sm rounded-2xl border p-8 shadow-xl" style={cardStyle}>
        {/* Header */}
        <div className="mb-6 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'var(--accent-blue)', opacity: 0.9 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {step === 'validating' && 'Validating Invite...'}
            {step === 'register' && 'Join Household'}
            {step === 'phone-verify' && 'Verify Phone Number'}
            {step === 'success' && 'Welcome!'}
            {step === 'error' && 'Invite Error'}
          </h1>
          {inviteInfo && step === 'register' && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              You've been invited to join <strong>{inviteInfo.orgName}</strong>
            </p>
          )}
        </div>

        {/* Validating */}
        {step === 'validating' && (
          <div className="text-center py-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Checking your invite...</p>
          </div>
        )}

        {/* Registration Form */}
        {step === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Email
              </label>
              <input
                type="email"
                value={inviteInfo?.email || ''}
                disabled
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none opacity-60"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none pr-10"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                  tabIndex={-1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPass ? (
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Confirm Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Phone Number (for 2FA)
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+15551234567"
                required
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                A verification code will be sent to this number
              </p>
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
              {submitting ? 'Creating account...' : 'Create Account & Verify Phone'}
            </button>

            <div className="text-center">
              <Link to="/" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
                Already have an account? Sign in
              </Link>
            </div>
          </form>
        )}

        {/* Phone OTP Verification */}
        {step === 'phone-verify' && (
          <div className="space-y-4">
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              Enter the 6-digit code sent to <strong>{phoneNumber}</strong>
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                autoFocus
                className="w-full rounded-lg border px-3 py-3 text-center text-2xl font-mono tracking-[0.5em] outline-none"
                style={inputStyle}
              />

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
                disabled={submitting || otpCode.length !== 6}
                className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent-blue)', color: '#fff', opacity: (submitting || otpCode.length !== 6) ? 0.6 : 1 }}
              >
                {submitting ? 'Verifying...' : 'Verify & Join Household'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => sendOtp()}
              disabled={otpSending}
              className="w-full text-sm py-1"
              style={{ color: 'var(--accent-blue)' }}
            >
              {otpSending ? 'Sending...' : 'Resend code'}
            </button>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2" style={{ color: 'var(--accent-emerald)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="text-sm font-medium">Account created & phone verified!</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              You've joined <strong>{inviteInfo?.orgName}</strong>. Two-factor authentication is now enabled.
            </p>
            <a
              href="/"
              className="inline-block w-full rounded-lg py-2.5 text-sm font-semibold text-center transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-blue)', color: '#fff' }}
            >
              Go to Dashboard
            </a>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="text-center space-y-4">
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              {error}
            </p>
            <Link
              to="/"
              className="inline-block text-sm hover:underline"
              style={{ color: 'var(--accent-blue)' }}
            >
              Go to login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
