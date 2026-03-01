import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Fetches parsed credit card statement data via the backend API.
 * No longer accesses S3 directly.
 */
export function useStatementStorage() {
  const [index, setIndex]           = useState(null)
  const [statements, setStatements] = useState({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  // Load index on mount
  useEffect(() => {
    async function loadIndex() {
      try {
        const res = await fetch(`${API_BASE}/api/statements`, {
          headers: { ...authHeaders() },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setIndex(data)
        setLoading(false)
      } catch (e) {
        setError(e.message)
        setIndex({ version: 1, lastUpdated: null, statements: [] })
        setLoading(false)
      }
    }
    loadIndex()
  }, [])

  // Lazy-load a full statement by ID
  const loadStatement = useCallback(async (statementId) => {
    if (statements[statementId]) return statements[statementId]
    try {
      const res = await fetch(`${API_BASE}/api/statements/${statementId}`, {
        headers: { ...authHeaders() },
      })
      if (!res.ok) throw new Error(`Failed to load statement ${statementId}`)
      const data = await res.json()
      setStatements(prev => ({ ...prev, [statementId]: data }))
      return data
    } catch (e) {
      setError(e.message)
      return null
    }
  }, [statements])

  // Re-fetch the index (after a new statement is parsed)
  const refreshIndex = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/statements`, {
        headers: { ...authHeaders() },
      })
      if (res.ok) {
        const data = await res.json()
        setIndex(data)
      }
    } catch { /* silent */ }
  }, [])

  return { index, statements, loading, error, loadStatement, refreshIndex }
}
