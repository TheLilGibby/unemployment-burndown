import { useState, useCallback, useEffect, useRef } from 'react'

const TOKEN_KEY = 'burndown_token'
const ADMIN_TOKEN_KEY = 'burndown_admin_token'
const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''

// Refresh tokens 5 minutes before they expire
const REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * Decode JWT payload without verification (for reading expiry on the client).
 * Returns null if the token is malformed.
 */
function decodeTokenPayload(token) {
  try {
    const base64 = token.split('.')[1]
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

// ── Singleton refresh state (shared across all hook instances) ──
let _refreshPromise = null
let _refreshTimer = null

async function _doRefresh() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token) return null

  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null

  const data = await res.json()
  if (data.token) {
    sessionStorage.setItem(TOKEN_KEY, data.token)
  }
  return data.token || null
}

/**
 * Attempt to refresh the token. Deduplicates concurrent calls so only
 * one network request is in-flight at a time.
 */
function refreshTokenSingleton() {
  if (!_refreshPromise) {
    _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null })
  }
  return _refreshPromise
}

/**
 * Authenticated fetch wrapper with automatic 401 retry.
 * On 401, attempts a token refresh and retries the request once.
 * Other hooks/components can import this for transparent token handling.
 */
export async function authFetch(url, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const headers = { ...options.headers }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { ...options, headers })

  if (res.status === 401 && token) {
    const newToken = await refreshTokenSingleton()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      return fetch(url, { ...options, headers })
    }
  }

  return res
}

async function parseResponse(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error('API not reachable — VITE_PLAID_API_URL may not be configured. Contact your admin.')
    }
    throw new Error(`Unexpected response from server (HTTP ${res.status})`)
  }
}

function extractError(data) {
  return data.error || data.message || null
}

export function useAuth() {
  const [authed, setAuthed] = useState(false)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mfaPending, setMfaPending] = useState(false)
  const [tempToken, setTempToken] = useState(null)
  const [impersonating, setImpersonating] = useState(false)

  const logoutRef = useRef(null)

  // Schedule proactive token refresh before expiry
  const scheduleRefresh = useCallback((token) => {
    if (_refreshTimer) {
      clearTimeout(_refreshTimer)
      _refreshTimer = null
    }
    const payload = decodeTokenPayload(token)
    if (!payload || !payload.exp) return

    const expiresAt = payload.exp * 1000
    const delay = expiresAt - Date.now() - REFRESH_BUFFER_MS
    if (delay <= 0) {
      // Token is already near expiry — refresh immediately
      refreshTokenSingleton().then(newToken => {
        if (newToken) {
          scheduleRefresh(newToken)
        } else if (logoutRef.current) {
          logoutRef.current()
        }
      })
      return
    }

    _refreshTimer = setTimeout(async () => {
      const newToken = await refreshTokenSingleton()
      if (newToken) {
        scheduleRefresh(newToken)
      } else if (logoutRef.current) {
        logoutRef.current()
      }
    }, delay)
  }, [])

  // Check for existing token on mount
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    // Detect impersonation state
    if (sessionStorage.getItem(ADMIN_TOKEN_KEY)) {
      setImpersonating(true)
    }
    // Validate token by calling /me
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (!res.ok) throw new Error('Token invalid')
        return parseResponse(res)
      })
      .then(userData => {
        setUser(userData)
        setAuthed(true)
        setLoading(false)
        scheduleRefresh(token)
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(ADMIN_TOKEN_KEY)
        setImpersonating(false)
        setLoading(false)
      })

    return () => {
      if (_refreshTimer) {
        clearTimeout(_refreshTimer)
        _refreshTimer = null
      }
    }
  }, [scheduleRefresh])

  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Login failed')
        return false
      }

      // MFA required — store temp token and prompt for code
      if (data.mfaRequired) {
        setTempToken(data.tempToken)
        setMfaPending(true)
        return 'mfa'
      }

      // Login successful
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      setAuthed(true)
      scheduleRefresh(data.token)
      return true
    } catch (e) {
      const msg = e.message || ''
      if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
        setError('Cannot reach the API — check that VITE_PLAID_API_URL is set to your deployed API Gateway URL.')
      } else {
        setError(msg || 'Network error. Please try again.')
      }
      return false
    }
  }, [scheduleRefresh])

  const verifyMfa = useCallback(async (code) => {
    setError(null)
    if (!tempToken) {
      setError('No pending MFA session')
      return false
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-mfa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tempToken}`,
        },
        body: JSON.stringify({ code }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Invalid code')
        return false
      }
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      setAuthed(true)
      setMfaPending(false)
      setTempToken(null)
      scheduleRefresh(data.token)
      return true
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [tempToken, scheduleRefresh])

  const register = useCallback(async (email, password, { inviteToken, phoneNumber } = {}) => {
    setError(null)
    try {
      const body = { email, password }
      if (inviteToken) body.inviteToken = inviteToken
      if (phoneNumber) body.phoneNumber = phoneNumber

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Registration failed')
        return false
      }
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      setAuthed(true)

      // Record privacy policy and registration consent for audit trail
      try {
        await fetch(`${API_BASE}/api/privacy/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify({ consentType: 'account_registration', consentVersion: '1.1' }),
        })
        await fetch(`${API_BASE}/api/privacy/consent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.token}`,
          },
          body: JSON.stringify({ consentType: 'privacy_policy', consentVersion: '1.1' }),
        })
      } catch {
        // Don't block registration if consent recording fails
      }

      scheduleRefresh(data.token)

      if (data.phoneVerificationRequired) {
        return { phoneVerificationRequired: true, token: data.token }
      }

      return true
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [scheduleRefresh])

  const sendPhoneOtp = useCallback(async (phoneNumber) => {
    setError(null)
    const token = sessionStorage.getItem(TOKEN_KEY)
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-phone-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Failed to send code')
        return false
      }
      return true
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [])

  const verifyPhoneOtp = useCallback(async (code) => {
    setError(null)
    const token = sessionStorage.getItem(TOKEN_KEY)
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-phone-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Verification failed')
        return false
      }
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      scheduleRefresh(data.token)
      return true
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [scheduleRefresh])

  const logout = useCallback(() => {
    if (_refreshTimer) {
      clearTimeout(_refreshTimer)
      _refreshTimer = null
    }
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    setAuthed(false)
    setUser(null)
    setMfaPending(false)
    setTempToken(null)
    setImpersonating(false)
  }, [])

  // Keep logoutRef in sync so the proactive timer can trigger logout
  useEffect(() => { logoutRef.current = logout }, [logout])

  const cancelMfa = useCallback(() => {
    setMfaPending(false)
    setTempToken(null)
    setError(null)
  }, [])

  // Helper to get current token for API calls
  const getToken = useCallback(() => {
    return sessionStorage.getItem(TOKEN_KEY)
  }, [])

  const updateProfile = useCallback(async ({ profileColor, avatarDataUrl } = {}) => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profileColor, avatarDataUrl }),
      })
      const data = await parseResponse(res)
      if (!res.ok) return { ok: false, error: extractError(data) || 'Update failed' }
      setUser(prev => ({
        ...prev,
        ...(profileColor !== undefined && { profileColor }),
        ...(avatarDataUrl !== undefined && { avatarDataUrl }),
      }))
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message || 'Network error. Please try again.' }
    }
  }, [])

  const devLogin = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Dev login failed')
        return false
      }
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      setAuthed(true)
      scheduleRefresh(data.token)
      return true
    } catch (e) {
      setError(e.message || 'Dev login failed')
      return false
    }
  }, [scheduleRefresh])

  const deleteAccount = useCallback(async () => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    try {
      const res = await fetch(`${API_BASE}/api/auth/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        return { ok: false, error: extractError(data) || 'Account deletion failed' }
      }
      // Clear local state
      sessionStorage.removeItem(TOKEN_KEY)
      setAuthed(false)
      setUser(null)
      setMfaPending(false)
      setTempToken(null)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message || 'Network error. Please try again.' }
    }
  }, [])

  const hasOrg = !!(user && user.orgId)

  const createOrg = useCallback(async (name) => {
    setError(null)
    const token = sessionStorage.getItem(TOKEN_KEY)
    try {
      const res = await fetch(`${API_BASE}/api/org/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Failed to create organization')
        return false
      }
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      return data.org
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [])

  const joinOrg = useCallback(async (joinCode) => {
    setError(null)
    const token = sessionStorage.getItem(TOKEN_KEY)
    try {
      const res = await fetch(`${API_BASE}/api/org/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ joinCode }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Failed to join organization')
        return false
      }
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      return data.org
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [])

  const forgotPassword = useCallback(async (email) => {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Request failed')
        return false
      }
      return data.message || true
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [])

  // ── Superadmin impersonation ──

  const impersonate = useCallback(async (targetUserId) => {
    setError(null)
    const token = sessionStorage.getItem(TOKEN_KEY)
    try {
      const res = await fetch(`${API_BASE}/api/admin/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Impersonation failed')
        return false
      }
      // Store original admin token so we can restore later
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      setImpersonating(true)
      return true
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [])

  const stopImpersonating = useCallback(async () => {
    const adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY)
    if (!adminToken) return

    sessionStorage.setItem(TOKEN_KEY, adminToken)
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    setImpersonating(false)

    // Reload admin user data
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (res.ok) {
        const userData = await parseResponse(res)
        setUser(userData)
      }
    } catch {
      // If fetch fails, just clear state — user can re-login
    }
  }, [])

  /**
   * Wrapper around fetch that automatically:
   *  - Injects the Bearer token
   *  - On 401, attempts a token refresh then retries the original request once
   *  - If refresh fails, logs the user out
   */
  const authFetch = useCallback(async (url, options = {}) => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const headers = { ...options.headers }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(url, { ...options, headers })

    if (res.status === 401) {
      const newToken = await refreshTokenSingleton()
      if (newToken) {
        scheduleRefresh(newToken)
        headers.Authorization = `Bearer ${newToken}`
        return fetch(url, { ...options, headers })
      }
      // Refresh failed — log out
      logout()
    }

    return res
  }, [logout, scheduleRefresh])

  return {
    authed,
    user,
    error,
    loading,
    mfaPending,
    hasOrg,
    impersonating,
    login,
    verifyMfa,
    register,
    logout,
    cancelMfa,
    getToken,
    authFetch,
    createOrg,
    joinOrg,
    updateProfile,
    devLogin,
    forgotPassword,
    deleteAccount,
    impersonate,
    stopImpersonating,
    sendPhoneOtp,
    verifyPhoneOtp,
  }
}
