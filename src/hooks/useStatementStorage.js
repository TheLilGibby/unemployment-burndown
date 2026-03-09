import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE, authHeaders, safeJson } from '../utils/apiClient'

/**
 * Fetches parsed credit card statement data via the backend API.
 * No longer accesses S3 directly.
 */
export function useStatementStorage() {
  const [index, setIndex]           = useState(null)
  const [statements, setStatements] = useState({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const inflightRef = useRef(new Set())

  // Load index on mount
  useEffect(() => {
    async function loadIndex() {
      try {
        const res = await fetch(`${API_BASE}/api/statements`, {
          headers: { ...authHeaders() },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await safeJson(res)
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

  // Lazy-load a full statement by ID (guards against duplicate in-flight requests)
  const loadStatement = useCallback(async (statementId) => {
    if (inflightRef.current.has(statementId)) return null
    inflightRef.current.add(statementId)
    try {
      const res = await fetch(`${API_BASE}/api/statements/${statementId}`, {
        headers: { ...authHeaders() },
      })
      if (!res.ok) throw new Error(`Failed to load statement ${statementId}`)
      const data = await safeJson(res)
      setStatements(prev => ({ ...prev, [statementId]: data }))
      return data
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      inflightRef.current.delete(statementId)
    }
  }, [])

  // Re-fetch the index (after a new statement is parsed)
  const refreshIndex = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/statements`, {
        headers: { ...authHeaders() },
      })
      if (res.ok) {
        const data = await safeJson(res)
        setIndex(data)
      }
    } catch { /* silent */ }
  }, [])

  // Patch a single transaction in a statement (marks it as user-modified on the backend)
  const patchTransaction = useCallback(async (statementId, transactionId, updates) => {
    try {
      const res = await fetch(`${API_BASE}/api/statements/${statementId}/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(updates),
      })
      if (!res.ok) return null
      const data = await safeJson(res)
      // Update local cache with the patched transaction
      if (data.transaction) {
        setStatements(prev => {
          const stmt = prev[statementId]
          if (!stmt) return prev
          return {
            ...prev,
            [statementId]: {
              ...stmt,
              transactions: stmt.transactions.map(t =>
                t.id === transactionId ? { ...t, ...data.transaction } : t
              ),
            },
          }
        })
      }
      return data
    } catch { return null }
  }, [])

  return { index, statements, loading, error, loadStatement, refreshIndex, patchTransaction }
}
