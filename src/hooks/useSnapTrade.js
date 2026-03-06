import { useState, useCallback, useRef } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Hook that manages the SnapTrade integration lifecycle:
 *   - Generating brokerage connection URLs (redirect-based flow)
 *   - Handling connection callbacks
 *   - Fetching connected investment accounts with holdings
 *   - Syncing holdings and balances
 *   - Disconnecting brokerages
 *
 * All server calls go through the backend API.
 * SnapTrade handles investment/brokerage accounts (Fidelity, etc.)
 * while Plaid handles credit cards and bank accounts.
 */
export function useSnapTrade({ onSyncComplete } = {}) {
  const [accounts, setAccounts]   = useState([])
  const [syncing, setSyncing]     = useState(false)
  const [lastSync, setLastSync]   = useState(null)
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const fetchedRef = useRef(false)

  async function apiCall(path, options = {}) {
    const url = `${API_BASE}${path}`
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      ...options,
    })
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error('API not reachable — backend may not be configured')
      }
      throw new Error(`Unexpected response (HTTP ${res.status})`)
    }
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`)
    return data
  }

  // ── Generate brokerage connect URL ──

  const generateConnectUrl = useCallback(async (broker = 'FIDELITY') => {
    setError(null)
    try {
      const data = await apiCall('/api/snaptrade/connect', {
        method: 'POST',
        body: JSON.stringify({ broker }),
      })
      return data.redirectUrl
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  // ── Handle callback after brokerage connection ──

  const handleCallback = useCallback(async (authorizationId) => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiCall('/api/snaptrade/callback', {
        method: 'POST',
        body: JSON.stringify({ authorizationId }),
      })
      if (data.accounts) {
        setAccounts(data.accounts)
      }
      setLoading(false)
      return data
    } catch (e) {
      setError(e.message)
      setLoading(false)
      throw e
    }
  }, [])

  // ── Fetch connected accounts ──

  const fetchAccounts = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiCall('/api/snaptrade/accounts')
      setAccounts(data.accounts || [])
      setLoading(false)
      fetchedRef.current = true
      return data.accounts
    } catch (e) {
      setError(e.message)
      setLoading(false)
      return []
    }
  }, [])

  // ── Sync holdings and balances ──

  const syncAll = useCallback(async (connectionId = null) => {
    setError(null)
    setSyncing(true)
    try {
      const body = {}
      if (connectionId) body.connectionId = connectionId

      const data = await apiCall('/api/snaptrade/sync', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (data.updated && data.accounts) {
        setAccounts(data.accounts)
        setLastSync(data.syncedAt || new Date().toISOString())

        if (onSyncComplete) {
          onSyncComplete(data.accounts)
        }
      }

      setSyncing(false)
      return data
    } catch (e) {
      setError(e.message)
      setSyncing(false)
      throw e
    }
  }, [onSyncComplete])

  // ── Disconnect a brokerage ──

  const disconnect = useCallback(async (connectionId) => {
    setError(null)
    try {
      await apiCall(`/api/snaptrade/connections/${connectionId}`, {
        method: 'DELETE',
      })
      setAccounts(prev => prev.filter(a =>
        a.id !== connectionId && a.connectionId !== connectionId
      ))
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  return {
    accounts,
    syncing,
    lastSync,
    error,
    loading,
    hasFetched: fetchedRef.current,

    generateConnectUrl,
    handleCallback,
    fetchAccounts,
    syncAll,
    disconnect,
    clearError: () => setError(null),
  }
}
