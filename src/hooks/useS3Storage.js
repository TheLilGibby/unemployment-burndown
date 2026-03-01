import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

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
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/data`, {
          headers: { ...authHeaders() },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data) {
          setRestoreData(data)
        }
        setStatus('connected')
      } catch (e) {
        setStatus('error')
        setErrorMsg(e.message)
      }
    }
    load()
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
