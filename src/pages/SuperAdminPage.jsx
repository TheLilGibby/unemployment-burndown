import { useState, useEffect, useCallback } from 'react'
import { Building2, Users, Eye, ChevronDown, ChevronRight, Search, Shield } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''

export default function SuperAdminPage() {
  const { getToken, impersonate } = useAuth()
  const [activeTab, setActiveTab] = useState('orgs')
  const [orgs, setOrgs] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [expandedOrg, setExpandedOrg] = useState(null)
  const [orgMembers, setOrgMembers] = useState({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const token = getToken()
    try {
      const endpoint = activeTab === 'orgs' ? '/api/admin/orgs' : '/api/admin/users'
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load data')
      const data = await res.json()
      if (activeTab === 'orgs') {
        setOrgs(data.orgs || [])
      } else {
        setAllUsers(data.users || [])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [activeTab, getToken])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleOrg = useCallback(async (orgId) => {
    if (expandedOrg === orgId) {
      setExpandedOrg(null)
      return
    }
    setExpandedOrg(orgId)
    if (!orgMembers[orgId]) {
      const token = getToken()
      try {
        const res = await fetch(`${API_BASE}/api/admin/orgs/${orgId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setOrgMembers(prev => ({ ...prev, [orgId]: data.members || [] }))
        }
      } catch { /* ignore */ }
    }
  }, [expandedOrg, orgMembers, getToken])

  const handleImpersonate = useCallback(async (userId) => {
    const ok = await impersonate(userId)
    if (ok) {
      window.location.href = '/'
    }
  }, [impersonate])

  const filteredOrgs = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.orgId.toLowerCase().includes(search.toLowerCase()) ||
    (o.ownerId || '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredUsers = allUsers.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.userId.toLowerCase().includes(search.toLowerCase()) ||
    (u.orgId || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8 text-red-500" />
            Super Admin
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage organizations and users across the system
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => { setActiveTab('orgs'); setSearch('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'orgs'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Organizations
            {orgs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {orgs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('users'); setSearch('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Users
            {allUsers.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {allUsers.length}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'orgs' ? 'Search organizations...' : 'Search users...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={fetchData} className="text-blue-500 hover:underline text-sm">Retry</button>
          </div>
        ) : activeTab === 'orgs' ? (
          <OrgsTable
            orgs={filteredOrgs}
            expandedOrg={expandedOrg}
            orgMembers={orgMembers}
            onToggle={toggleOrg}
            onImpersonate={handleImpersonate}
          />
        ) : (
          <UsersTable users={filteredUsers} onImpersonate={handleImpersonate} />
        )}
      </div>
    </div>
  )
}

function OrgsTable({ orgs, expandedOrg, orgMembers, onToggle, onImpersonate }) {
  if (orgs.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        No organizations found
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {orgs.map(org => (
        <div key={org.orgId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => onToggle(org.orgId)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{org.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {org.orgId} &middot; Owner: {org.ownerId}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
              </span>
              {expandedOrg === org.orgId
                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-400" />
              }
            </div>
          </button>

          {expandedOrg === org.orgId && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3">
              {orgMembers[org.orgId] ? (
                <div className="space-y-2">
                  {orgMembers[org.orgId].map(member => (
                    <div key={member.userId} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                          {(member.email || member.userId).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{member.email}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {member.role} &middot; Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onImpersonate(member.userId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        Impersonate
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function UsersTable({ users, onImpersonate }) {
  if (users.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        No users found
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Organization</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">MFA</th>
            <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {users.map(u => (
            <tr key={u.userId} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{u.email}</div>
                    {u.orgRole && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{u.orgRole}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-5 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                {u.orgId ? (
                  <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{u.orgId}</span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 italic">None</span>
                )}
              </td>
              <td className="px-5 py-3 hidden md:table-cell">
                {u.mfaEnabled ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                    Enabled
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500">Off</span>
                )}
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => onImpersonate(u.userId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  Impersonate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
