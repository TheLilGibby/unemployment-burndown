import { useState, useEffect, useCallback } from 'react'
import { API_BASE, authHeaders, safeJson } from '../utils/apiClient'

/**
 * Cloud storage backed by the backend API (which proxies to S3).
 * No longer accesses S3 directly — all data flows through authenticated API.
 *
 * status values:
 *   'loading'   - initial fetch in progress
 *   'connected' - ready; last save succeeded (or no data yet)
 *   'saving'    - PUT in progress
 *   'error'     - last operation failed
 */
export function useS3Storage() {
  const [status, setStatus]           = useState('loading')
  const [lastSaved, setLastSaved]     = useState(null)
  const [restoreData, setRestoreData] = useState(null)
  const [errorMsg, setErrorMsg]       = useState(null)

  // Load existing data on mount via API
  useEffect(() => {
    const ac = new AbortController()
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/data`, {
          headers: { ...authHeaders() },
          signal: ac.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await safeJson(res)
        if (data) {
          setRestoreData(data)
        }
        setStatus('connected')
      } catch (e) {
        if (e.name === 'AbortError') return
        setStatus('error')
        setErrorMsg(e.message)
      }
    }
    load()
    return () => ac.abort()
  }, [])

  const clearRestoreData = useCallback(() => setRestoreData(null), [])

  const save = useCallback(async (data) => {
    try {
      setStatus('saving')
      const res = await fetch(`${API_BASE}/api/data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(data, null, 2),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('connected')
      setLastSaved(new Date())
      setErrorMsg(null)
    } catch (e) {
      setStatus('error')
      setErrorMsg(e.message)
    }
  }, [])

  return { status, lastSaved, restoreData, clearRestoreData, errorMsg, save }
}
