import { useState, useCallback, useRef, useEffect } from 'react'

const MAX_ENTRIES    = 2000
const RETENTION_DAYS = 180
const BASE_LOG_KEY   = 'burndown-activity-log'
const BASE_NAME_KEY  = 'burndown-user-name'

function logKey(userId)  { return userId ? `${BASE_LOG_KEY}-${userId}` : BASE_LOG_KEY }
function nameKey(userId) { return userId ? `${BASE_NAME_KEY}-${userId}` : BASE_NAME_KEY }

function retentionCutoff() {
  return Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
}

function loadLog(userId) {
  try {
    const key = logKey(userId)
    const raw = localStorage.getItem(key)
    if (!raw) {
      // Migrate from unscoped key if this is a first load with a userId
      if (userId) {
        const legacy = localStorage.getItem(BASE_LOG_KEY)
        if (legacy) {
          localStorage.setItem(key, legacy)
          localStorage.removeItem(BASE_LOG_KEY)
          return JSON.parse(legacy)
            .map(e => ({ ...e, timestamp: new Date(e.timestamp) }))
            .filter(e => e.timestamp.getTime() > retentionCutoff())
        }
      }
      return []
    }
    const cutoff = retentionCutoff()
    return JSON.parse(raw)
      .map(e => ({ ...e, timestamp: new Date(e.timestamp) }))
      .filter(e => e.timestamp.getTime() > cutoff)
  } catch { return [] }
}

export function useActivityLog(userId) {
  const currentUserId = useRef(userId)
  const [entries, setEntries]        = useState(() => loadLog(userId))
  const [userName, setUserNameState] = useState(
    () => localStorage.getItem(nameKey(userId)) || 'You'
  )

  // Reload entries when userId changes (login/logout/switch)
  useEffect(() => {
    if (currentUserId.current === userId) return
    currentUserId.current = userId
    setEntries(loadLog(userId))
    setUserNameState(localStorage.getItem(nameKey(userId)) || 'You')
  }, [userId])

  const setUserName = useCallback((name) => {
    const trimmed = (name || '').trim() || 'You'
    setUserNameState(trimmed)
    localStorage.setItem(nameKey(currentUserId.current), trimmed)
  }, [])

  const addEntry = useCallback((type, message, diff = null) => {
    setEntries(prev => {
      // Deduplicate rapid 'change' entries for the same section (within 2s):
      // keep the original 'before', only update 'after' + timestamp
      if (type === 'change' && prev.length > 0) {
        const last = prev[0]
        if (last.type === 'change' && last.message === message &&
            (Date.now() - last.timestamp.getTime()) < 2000) {
          const updated = {
            ...last,
            timestamp: new Date(),
            diff: diff ? { before: last.diff?.before ?? diff.before, after: diff.after } : last.diff,
          }
          const next = [updated, ...prev.slice(1)].slice(0, MAX_ENTRIES)
          try { localStorage.setItem(logKey(currentUserId.current), JSON.stringify(next)) } catch {}
          return next
        }
      }
      const entry = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2),
        timestamp: new Date(),
        type,    // 'save' | 'load' | 'change'
        message,
        diff,    // { before: string, after: string } | null
      }
      const next = [entry, ...prev].slice(0, MAX_ENTRIES)
      try { localStorage.setItem(logKey(currentUserId.current), JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Called when S3 data is restored — merges cloud entries with local,
  // deduplicates, applies 180-day retention, and syncs back to localStorage.
  const loadEntries = useCallback((s3Entries) => {
    if (!Array.isArray(s3Entries) || s3Entries.length === 0) return
    setEntries(prev => {
      const cutoff = retentionCutoff()
      // Parse timestamps on S3 entries (serialised as ISO strings)
      const parsed = s3Entries.map(e => ({ ...e, timestamp: new Date(e.timestamp) }))
      // Merge local + cloud, deduplicate by id, sort newest-first
      const merged = [...prev, ...parsed]
      const seen   = new Set()
      const unique = merged.filter(e => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })
      unique.sort((a, b) => b.timestamp - a.timestamp)
      // Apply 180-day TTL and entry cap
      const pruned = unique.filter(e => e.timestamp.getTime() > cutoff).slice(0, MAX_ENTRIES)
      try { localStorage.setItem(logKey(currentUserId.current), JSON.stringify(pruned)) } catch {}
      return pruned
    })
  }, [])

  const clearLog = useCallback(() => {
    setEntries([])
    try { localStorage.removeItem(logKey(currentUserId.current)) } catch {}
  }, [])

  return { entries, addEntry, clearLog, loadEntries, userName, setUserName }
}
