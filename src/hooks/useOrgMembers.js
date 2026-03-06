import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'

/**
 * Fetches org member profiles (userId, email, profileColor, avatarDataUrl)
 * so they can be displayed alongside transactions.
 *
 * Returns { members, membersByUserId, refreshMembers }
 */
export function useOrgMembers(user) {
  const [members, setMembers] = useState([])

  const fetchMembers = useCallback(async () => {
    if (!user?.orgId) return
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/org`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setMembers(data.members || [])
    } catch {
      // Non-critical — silently fail
    }
  }, [user?.orgId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Build a lookup map: userId → member profile
  const membersByUserId = {}
  for (const m of members) {
    membersByUserId[m.userId] = m
  }

  return { members, membersByUserId, refreshMembers: fetchMembers }
}
