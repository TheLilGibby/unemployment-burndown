import { useState } from 'react'
import { Link } from 'react-router-dom'
import goragLogo from '../../assets/gorag-logo.svg'
import { validateEmail, validatePassword } from '../../utils/validation'

export default function LoginScreen({ onLogin, onRegister, onVerifyMfa, onCancelMfa, onDevLogin, onForgotPassword, mfaPending, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [localError, setLocalError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitted, setForgotSubmitted] = useState(false)

  const displayError = error || localError

  async function handleSubmit(e) {
    e.preventDefault()
    setLocalError(null)
    setFieldErrors({})
    setSubmitting(true)

    const errors = {}
    const emailErr = validateEmail(email)
    if (emailErr) errors.email = emailErr
    const passErr = validatePassword(password, { isRegister })
    if (passErr) errors.password = passErr

    if (isRegister) {
      if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      setSubmitting(false)
      return
    }

    if (isRegister) {
      await onRegister(email, password)
    } else {
      await onLogin(email, password)
    }
    setSubmitting(false)
  }

  async function handleMfaSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    await onVerifyMfa(mfaCode)
    setSubmitting(false)
  }

  async function handleForgotSubmit(e) {
    e.preventDefault()
    setLocalError(null)
    setFieldErrors({})
    setSubmitting(true)
    const emailErr = validateEmail(forgotEmail)
    if (emailErr) {
      setFieldErrors({ forgotEmail: emailErr })
      setSubmitting(false)
      return
    }
    const result = await onForgotPassword(forgotEmail)
    if (result) setForgotSubmitted(true)
    setSubmitting(false)
  }

  // Forgot password screen
  if (showForgot) {
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
              Reset Password
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {forgotSubmitted
                ? 'Check your email for a reset link.'
                : 'Enter your email to receive a password reset link.'}
            </p>
          </div>

          {!forgotSubmitted ? (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="forgotEmail"
                  className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Email
                </label>
                <input
                  id="forgotEmail"
                  type="email"
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); setFieldErrors(prev => ({ ...prev, forgotEmail: undefined })) }}
                  required
                  autoFocus
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: fieldErrors.forgotEmail ? 'var(--accent-red)' : 'var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                />
                {fieldErrors.forgotEmail && (
                  <p className="text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{fieldErrors.forgotEmail}</p>
                )}
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
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>
              If an account with that email exists, you will receive a password reset link shortly.
            </p>
          )}

          <button
            type="button"
            onClick={() => { setShowForgot(false); setForgotSubmitted(false); setLocalError(null) }}
            className="w-full text-sm py-1 mt-4"
            style={{ color: 'var(--text-muted)' }}
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  // MFA verification screen
  if (mfaPending) {
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
              Two-Factor Authentication
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Enter the code from your authenticator app
            </p>
          </div>

          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                autoFocus
                className="w-full rounded-lg border px-3 py-3 text-center text-2xl font-mono tracking-[0.5em] outline-none transition-colors focus:ring-1"
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
              disabled={submitting || mfaCode.length !== 6}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-blue)', color: '#fff', opacity: (submitting || mfaCode.length !== 6) ? 0.6 : 1 }}
            >
              {submitting ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={onCancelMfa}
              className="w-full text-sm py-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Login / Register screen
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8 shadow-xl"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
      >
        <div className="mb-8 text-center">
          <img src={goragLogo} alt="GoRAG" className="mx-auto mb-4" style={{ height: 48 }} />
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {isRegister ? 'Create your account' : 'Sign in to access your data'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: undefined })) }}
              required
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
              style={{
                background: 'var(--bg-input)',
                borderColor: fieldErrors.email ? 'var(--accent-red)' : 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
            {fieldErrors.email && (
              <p className="text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
              style={{ color: 'var(--text-muted)' }}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: undefined })) }}
                required
                minLength={8}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1 pr-10"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: fieldErrors.password ? 'var(--accent-red)' : 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
                tabIndex={-1}
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{fieldErrors.password}</p>
            )}
          </div>

          {!isRegister && (
            <div className="text-right -mt-1">
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotEmail(email); setLocalError(null) }}
                className="text-xs hover:underline"
                style={{ color: 'var(--accent-blue)' }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {isRegister && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(prev => ({ ...prev, confirmPassword: undefined })) }}
                required
                minLength={8}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: fieldErrors.confirmPassword ? 'var(--accent-red)' : 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              {fieldErrors.confirmPassword && (
                <p className="text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{fieldErrors.confirmPassword}</p>
              )}
            </div>
          )}

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
            className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 mt-2"
            style={{ background: 'var(--accent-blue)', color: '#fff', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? (isRegister ? 'Creating account...' : 'Signing in...') : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(v => !v)
              setLocalError(null)
              setFieldErrors({})
            }}
            className="text-sm hover:underline"
            style={{ color: 'var(--accent-blue)' }}
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link
            to="/privacy"
            className="text-xs hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Privacy Policy
          </Link>
        </div>

        {import.meta.env.DEV && onDevLogin && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px dashed var(--border-default)' }}>
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true)
                setLocalError(null)
                await onDevLogin()
                setSubmitting(false)
              }}
              className="w-full rounded-lg py-2 text-xs font-medium transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-amber, #f59e0b)', color: '#000', opacity: submitting ? 0.6 : 1 }}
            >
              Dev Login (test@test.com)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
