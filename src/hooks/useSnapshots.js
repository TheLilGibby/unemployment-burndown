import { useState, useEffect, useCallback } from 'react'
import { API_BASE, authHeaders, safeJson } from '../utils/apiClient'

/**
 * Manages historical daily snapshots stored on the backend.
 *
 * - availableDates: sorted list of 'YYYY-MM-DD' strings with saved snapshots
 * - saveSnapshot(stateObj): call on every auto-save; server is idempotent (once per day)
 * - loadSnapshot(date): fetches the full state object for that date
 */
export function useSnapshots() {
  const [availableDates, setAvailableDates] = useState([])
  const [indexLoading, setIndexLoading]     = useState(true)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load snapshot index on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/snapshots`, { headers: authHeaders() })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await safeJson(res)
        setAvailableDates(Array.isArray(data?.dates) ? data.dates : [])
      } catch (e) {
        setError(e.message)
      } finally {
        setIndexLoading(false)
      }
    }
    load()
  }, [])

  // Save a snapshot for today — idempotent (server only writes once per calendar day)
  const saveSnapshot = useCallback(async (stateSnapshot) => {
    try {
      const res = await fetch(`${API_BASE}/api/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(stateSnapshot),
      })
      if (!res.ok) return
      const data = await safeJson(res)
      // Update local index if a new date was created
      if (!data.alreadyExisted && data.date) {
        setAvailableDates(prev =>
          [...new Set([...prev, data.date])].sort()
        )
      }
    } catch {
      // Snapshot failure must never disrupt the primary auto-save
    }
  }, [])

  // Lazily fetch a specific date's snapshot state
  const loadSnapshot = useCallback(async (date) => {
    setSnapshotLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/snapshots/${date}`, { headers: authHeaders() })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await safeJson(res)
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setSnapshotLoading(false)
    }
  }, [])

  return {
    availableDates,   // string[] of 'YYYY-MM-DD', newest last
    indexLoading,
    snapshotLoading,
    error,
    saveSnapshot,
    loadSnapshot,
  }
}
