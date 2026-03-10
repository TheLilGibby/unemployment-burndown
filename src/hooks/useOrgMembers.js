import { useState, useEffect, useCallback } from 'react'
import { API_BASE, getToken, authHeaders } from '../utils/apiClient'

/**
 * Fetches org member profiles (userId, email, profileColor, avatarDataUrl)
 * so they can be displayed alongside transactions.
 *
 * Returns { members, membersByUserId, refreshMembers }
 */
export function useOrgMembers(user) {
  const [members, setMembers] = useState([])

  const fetchMembers = useCallback(async (signal) => {
    if (!user?.orgId) return
    if (!getToken()) return
    try {
      const res = await fetch(`${API_BASE}/api/org`, {
        headers: authHeaders(),
        signal,
      })
      if (!res.ok) return
      const data = await res.json()
      setMembers(data.members || [])
    } catch (e) {
      if (e.name === 'AbortError') return
      // Non-critical — silently fail
    }
  }, [user?.orgId])

  useEffect(() => {
    const ac = new AbortController()
    fetchMembers(ac.signal)
    return () => ac.abort()
  }, [fetchMembers])

  // Build a lookup map: userId → member profile
  const membersByUserId = {}
  for (const m of members) {
    membersByUserId[m.userId] = m
  }

  return { members, membersByUserId, refreshMembers: fetchMembers }
}
