import { useState, useCallback, useEffect } from 'react'

const TOKEN_KEY = 'burndown_token'
const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''

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

  // Check for existing token on mount
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
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
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY)
        setLoading(false)
      })
  }, [])

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
  }, [])

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
      return true
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [tempToken])

  const register = useCallback(async (email, password) => {
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await parseResponse(res)
      if (!res.ok) {
        setError(extractError(data) || 'Registration failed')
        return false
      }
      sessionStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      setAuthed(true)
      return true
    } catch (e) {
      setError(e.message || 'Network error. Please try again.')
      return false
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setAuthed(false)
    setUser(null)
    setMfaPending(false)
    setTempToken(null)
  }, [])

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

  return {
    authed,
    user,
    error,
    loading,
    mfaPending,
    hasOrg,
    login,
    verifyMfa,
    register,
    logout,
    cancelMfa,
    getToken,
    createOrg,
    joinOrg,
    updateProfile,
    forgotPassword,
  }
}
