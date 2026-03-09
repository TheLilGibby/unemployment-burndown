import { useState, useCallback, useRef, useEffect } from 'react'
import { apiFetch } from '../utils/apiClient'

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
  const cleanupRef = useRef(null)

  // ── Fetch connected brokerage accounts ──

  const fetchAccounts = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiFetch('/snaptrade/accounts')
      setConnections(data?.connections || [])
      setLoading(false)
      fetchedRef.current = true
      return data?.connections
    } catch (e) {
      setError(e.message)
      setLoading(false)
      return []
    }
  }, [])

  // ── Connect brokerage (register + open portal popup) ──

  const connect = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiFetch('/snaptrade/connect', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const portalUrl = data.portalUrl || data.redirectUrl
      if (!portalUrl) throw new Error('No portal URL returned')

      // Open SnapTrade portal in a popup
      const popup = window.open(portalUrl, 'snaptrade-connect', 'width=500,height=700')

      const expectedOrigin = new URL(portalUrl).origin

      return new Promise((resolve, reject) => {
        let resolved = false

        const handleMessage = (event) => {
          if (event.origin !== expectedOrigin) return
          // SnapTrade portal sends postMessage on success
          if (event.data?.status === 'SUCCESS' && event.data?.authorizationId) {
            resolved = true
            window.removeEventListener('message', handleMessage)
            clearInterval(pollInterval)
            cleanupRef.current = null

            apiFetch('/snaptrade/callback', {
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
              cleanupRef.current = null
              setLoading(false)
              // Refresh accounts in case connection was made before close
              fetchAccounts()
              resolve(null)
            }
          }
        }, 500)

        cleanupRef.current = () => {
          window.removeEventListener('message', handleMessage)
          clearInterval(pollInterval)
        }
      })
    } catch (e) {
      setError(e.message)
      setLoading(false)
      throw e
    }
  }, [fetchAccounts])

  // ── Reconnect an existing brokerage (re-authenticate) ──

  const reconnect = useCallback(async (connectionId) => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiFetch('/snaptrade/reconnect', {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
      })

      const portalUrl = data.portalUrl || data.redirectUrl
      if (!portalUrl) throw new Error('No portal URL returned')

      const popup = window.open(portalUrl, 'snaptrade-reconnect', 'width=500,height=700')
      const expectedOrigin = new URL(portalUrl).origin

      return new Promise((resolve, reject) => {
        let resolved = false

        const handleMessage = (event) => {
          if (event.origin !== expectedOrigin) return
          if (event.data?.status === 'SUCCESS') {
            resolved = true
            window.removeEventListener('message', handleMessage)
            clearInterval(pollInterval)
            cleanupRef.current = null
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
              cleanupRef.current = null
              setLoading(false)
              fetchAccounts()
              resolve(null)
            }
          }
        }, 500)

        cleanupRef.current = () => {
          window.removeEventListener('message', handleMessage)
          clearInterval(pollInterval)
        }
      })
    } catch (e) {
      setError(e.message)
      setLoading(false)
      throw e
    }
  }, [fetchAccounts])

  // ── Sync holdings + balances ──

  const syncAll = useCallback(async (connectionId = null) => {
    setError(null)
    setSyncing(true)
    try {
      const body = {}
      if (connectionId) body.connectionId = connectionId

      const data = await apiFetch('/snaptrade/sync', {
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
      await apiFetch('/snaptrade/disconnect', {
        method: 'POST',
        body: JSON.stringify({ connectionId }),
      })
      setConnections(prev => prev.filter(c => c.connectionId !== connectionId))
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  // Tear down any lingering event listener / interval on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current()
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
