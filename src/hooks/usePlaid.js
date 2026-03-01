import { useState, useCallback, useRef } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Hook that manages the Plaid integration lifecycle:
 *   - Creating link tokens (to open Plaid Link)
 *   - Exchanging public tokens for access tokens
 *   - Fetching connected accounts
 *   - Syncing transactions + balances
 *   - Disconnecting items
 *
 * All server calls go through the SAM-deployed Lambda backend.
 * Authentication is handled via JWT in the Authorization header.
 * Plaid items are scoped to the user's organization.
 */
export function usePlaid({ onSyncComplete } = {}) {
  const [linkedItems, setLinkedItems]   = useState([])     // connected institutions
  const [syncing, setSyncing]           = useState(false)
  const [lastSync, setLastSync]         = useState(null)
  const [error, setError]               = useState(null)
  const [loading, setLoading]           = useState(false)
  const fetchedRef = useRef(false)

  // ── Helpers ──

  async function apiCall(path, options = {}) {
    const url = `${API_BASE}${path}`
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      ...options,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return data
  }

  // ── Create link token ──

  const createLinkToken = useCallback(async () => {
    setError(null)
    try {
      const data = await apiCall('/plaid/link-token', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      return data.link_token
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  // ── Exchange public token ──

  const exchangeToken = useCallback(async (publicToken, metadata = {}) => {
    setError(null)
    setLoading(true)
    try {
      const data = await apiCall('/plaid/exchange', {
        method: 'POST',
        body: JSON.stringify({ public_token: publicToken, metadata }),
      })

      // Add to linked items
      setLinkedItems(prev => [
        ...prev.filter(i => i.itemId !== data.itemId),
        {
          itemId:          data.itemId,
          institutionName: data.institutionName,
          institutionId:   data.institutionId,
          accounts:        data.accounts,
          lastSync:        new Date().toISOString(),
        },
      ])

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
      const data = await apiCall('/plaid/accounts')
      setLinkedItems(data.items || [])
      setLoading(false)
      fetchedRef.current = true
      return data.items
    } catch (e) {
      setError(e.message)
      setLoading(false)
      // Don't throw — no linked accounts is fine
      return []
    }
  }, [])

  // ── Sync transactions + balances ──

  const syncAll = useCallback(async (itemId = null) => {
    setError(null)
    setSyncing(true)
    try {
      const body = {}
      if (itemId) body.itemId = itemId

      const data = await apiCall('/plaid/sync', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (data.updated && data.data) {
        setLastSync(new Date().toISOString())

        // Notify parent to apply the updated data
        if (onSyncComplete) {
          onSyncComplete(data.data)
        }
      }

      // Refresh account list
      await fetchAccounts()

      setSyncing(false)
      return data
    } catch (e) {
      setError(e.message)
      setSyncing(false)
      throw e
    }
  }, [onSyncComplete, fetchAccounts])

  // ── Disconnect an item ──

  const disconnect = useCallback(async (itemId) => {
    setError(null)
    try {
      await apiCall('/plaid/disconnect', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      })
      setLinkedItems(prev => prev.filter(i => i.itemId !== itemId))
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  return {
    // State
    linkedItems,
    syncing,
    lastSync,
    error,
    loading,
    hasFetched: fetchedRef.current,

    // Actions
    createLinkToken,
    exchangeToken,
    fetchAccounts,
    syncAll,
    disconnect,
    clearError: () => setError(null),
  }
}
