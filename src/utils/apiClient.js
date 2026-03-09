/**
 * Centralized API client with auth headers, safe JSON parsing,
 * token refresh on 401, and standardized error extraction.
 *
 * All hooks and components should import from here instead of
 * re-declaring API_BASE, TOKEN_KEY, authHeaders(), or safeJson().
 */

export const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
export const TOKEN_KEY = 'burndown_token'

// ── Token helpers ──

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Response parsing ──

/**
 * Safely parse a fetch Response as JSON.
 * Detects HTML error pages (API unreachable) and provides a clear message.
 */
export async function safeJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error('API not reachable — backend may not be configured')
    }
    throw new Error(`Unexpected response from server (HTTP ${res.status})`)
  }
}

/**
 * Extract a human-readable error message from an API response body.
 */
export function extractError(data) {
  return data.error || data.message || null
}

// ── Token refresh singleton ──

let _refreshPromise = null

async function _doRefresh() {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.token) {
      setToken(data.token)
    }
    return data.token || null
  } catch {
    return null
  }
}

/**
 * Attempt to refresh the auth token. Deduplicates concurrent calls so only
 * one network request is in-flight at a time.
 */
export function refreshTokenSingleton() {
  if (!_refreshPromise) {
    _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null })
  }
  return _refreshPromise
}

// ── Centralized fetch ──

/**
 * Authenticated fetch wrapper that:
 *  - Prepends API_BASE to the path
 *  - Injects Content-Type and Authorization headers
 *  - Parses the response with safeJson
 *  - Throws on non-ok responses with extracted error message
 *  - Retries once on 401 after attempting a token refresh
 *
 * @param {string} path - API path (e.g. '/api/jobs')
 * @param {RequestInit} [options] - Standard fetch options
 * @returns {Promise<any>} Parsed JSON response body
 */
export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let res = await fetch(url, { ...options, headers })

  // Auto-retry on 401 with token refresh
  if (res.status === 401 && token) {
    const newToken = await refreshTokenSingleton()
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`
      res = await fetch(url, { ...options, headers })
    }
  }

  const data = await safeJson(res)
  if (!res.ok) {
    throw new Error(extractError(data) || `Request failed (${res.status})`)
  }
  return data
}
