import { useState } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''

/**
 * MFA setup component. Shows in a settings panel.
 * Generates QR code, lets user scan with authenticator app, then verify.
 */
export default function MfaSetup({ mfaEnabled, onMfaChange }) {
  const [step, setStep] = useState('idle') // idle | loading | scan | verify | done | error
  const [qrCode, setQrCode] = useState(null)
  const [secret, setSecret] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)

  function getToken() {
    return sessionStorage.getItem('burndown_token')
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

  async function startSetup() {
    setStep('loading')
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/auth/setup-mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || data.message)
      setQrCode(data.qrCode)
      setSecret(data.secret)
      setStep('scan')
    } catch (e) {
      setError(e.message)
      setStep('error')
    }
  }

  async function verifyAndEnable() {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/auth/enable-mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ code }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || data.message)
      setStep('done')
      onMfaChange?.(true)
    } catch (e) {
      setError(e.message)
    }
  }

  if (mfaEnabled && step !== 'done') {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
        <div className="flex items-center gap-2 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-emerald)' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span style={{ color: 'var(--accent-emerald)' }}>Two-factor authentication is enabled</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Two-Factor Authentication (2FA)
      </h3>

      {step === 'idle' && (
        <>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            Add an extra layer of security to your account with a TOTP authenticator app.
          </p>
          <button
            onClick={startSetup}
            className="px-3 py-1.5 text-xs rounded-lg font-medium"
            style={{ background: 'var(--accent-blue)', color: '#fff' }}
          >
            Set Up 2FA
          </button>
        </>
      )}

      {step === 'loading' && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Generating QR code...</p>
      )}

      {step === 'scan' && (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
          </p>
          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="MFA QR Code" className="w-48 h-48 rounded-lg" />
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Or enter this key manually: <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-input)' }}>{secret}</code>
          </p>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Enter the 6-digit code to verify:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="rounded-lg border px-3 py-2 text-sm font-mono tracking-wider w-32 outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={verifyAndEnable}
                disabled={code.length !== 6}
                className="px-3 py-2 text-xs rounded-lg font-medium"
                style={{
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  opacity: code.length !== 6 ? 0.5 : 1,
                }}
              >
                Verify & Enable
              </button>
            </div>
          </div>
          {error && (
            <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--accent-emerald)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          2FA has been enabled successfully!
        </div>
      )}

      {step === 'error' && (
        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--accent-red)' }}>{error}</p>
          <button
            onClick={startSetup}
            className="text-xs hover:underline"
            style={{ color: 'var(--accent-blue)' }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
