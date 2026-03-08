import { useState, useCallback, useRef } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Hook that manages the SnapTrade brokerage integration lifecycle:
 *   - Connecting brokerages (register + portal popup)
 *   - Fetching connected brokerage accounts
 *   - Syncing holdings + balances
 *   - Disconnecting brokerages
 *
 * Mirrors the usePlaid hook pattern exactly.
 */
export function useSnapTrade({ onSyncComplete } = {}) {
  const [connections, setConnections] = useState([])
  const [syncing, setSyncing]         = useState(false)
  const [lastSync, setLastSync]       = useState(null)
  const [error, setError]             = useState(null)
  const [loading, setLoading]         = useState(false)
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

  // ── Connect brokerage (register + open portal popup) ──

  const connect = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiCall('/snaptrade/connect', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const portalUrl = data.portalUrl
      if (!portalUrl) throw new Error('No portal URL returned')

      // Open SnapTrade portal in a popup
      const popup = window.open(portalUrl, 'snaptrade-connect', 'width=500,height=700')

      return new Promise((resolve, reject) => {
        let resolved = false

        const handleMessage = (event) => {
          // SnapTrade portal sends postMessage on success
          if (event.data?.status === 'SUCCESS' && event.data?.authorizationId) {
            resolved = true
            window.removeEventListener('message', handleMessage)
            clearInterval(pollInterval)

            apiCall('/snaptrade/callback', {
              method: 'POST',
              body: JSON.stringify({ authorizationId: event.data.authorizationId }),
            }).then((result) => {
              fetchAccounts()
              setLoading(false)
              resolve(result)
            }).catch((err) => {
              setError(err.message)
              setLoading(false)
              reject(err)
            })
          }
        }

        window.addEventListener('message', handleMessage)

        // Poll for popup close (fallback if postMessage not received)
        const pollInterval = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(pollInterval)
            if (!resolved) {
              window.removeEventListener('message', handleMessage)
              setLoading(false)
              // Refresh accounts in case connection was made before close
              fetchAccounts()
              resolve(null)
            }
          }
        }, 500)
      })
    } catch (e) {
      setError(e.message)
      setLoading(false)
      throw e
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reconnect an existing brokerage (re-authenticate) ──

  const reconnect = useCallback(async (connectionId) => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiCall('/snaptrade/reconnect', {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
      })

      const portalUrl = data.portalUrl
      if (!portalUrl) throw new Error('No portal URL returned')

      const popup = window.open(portalUrl, 'snaptrade-reconnect', 'width=500,height=700')

      return new Promise((resolve, reject) => {
        let resolved = false

        const handleMessage = (event) => {
          if (event.data?.status === 'SUCCESS') {
            resolved = true
            window.removeEventListener('message', handleMessage)
            clearInterval(pollInterval)
            fetchAccounts()
            setLoading(false)
            resolve({ reconnected: true })
          }
        }

        window.addEventListener('message', handleMessage)

        const pollInterval = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(pollInterval)
            if (!resolved) {
              window.removeEventListener('message', handleMessage)
              setLoading(false)
              fetchAccounts()
              resolve(null)
            }
          }
        }, 500)
      })
    } catch (e) {
      setError(e.message)
      setLoading(false)
      throw e
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch connected brokerage accounts ──

  const fetchAccounts = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiCall('/snaptrade/accounts')
      setConnections(data.connections || [])
      setLoading(false)
      fetchedRef.current = true
      return data.connections
    } catch (e) {
      setError(e.message)
      setLoading(false)
      return []
    }
  }, [])

  // ── Sync holdings + balances ──

  const syncAll = useCallback(async (connectionId = null) => {
    setError(null)
    setSyncing(true)
    try {
      const body = {}
      if (connectionId) body.connectionId = connectionId

      const data = await apiCall('/snaptrade/sync', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (data.updated && data.data) {
        setLastSync(new Date().toISOString())
        if (onSyncComplete) {
          onSyncComplete(data.data)
        }
      }

      await fetchAccounts()

      setSyncing(false)
      return data
    } catch (e) {
      setError(e.message)
      setSyncing(false)
      throw e
    }
  }, [onSyncComplete, fetchAccounts])

  // ── Disconnect a brokerage ──

  const disconnect = useCallback(async (connectionId) => {
    setError(null)
    try {
      await apiCall('/snaptrade/disconnect', {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
      })
      setConnections(prev => prev.filter(c => c.connectionId !== connectionId))
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  return {
    connections,
    syncing,
    lastSync,
    error,
    loading,
    hasFetched: fetchedRef.current,

    connect,
    reconnect,
    fetchAccounts,
    syncAll,
    disconnect,
    clearError: () => setError(null),
  }
}
