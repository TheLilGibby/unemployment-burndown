import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''

// ---------------------------------------------------------------------------
// AWS service cost model based on actual infrastructure (template.yaml)
// Prices sourced from AWS us-west-1 pricing (arm64 Lambda, on-demand DynamoDB)
// ---------------------------------------------------------------------------

const AWS_SERVICES = [
  {
    id: 'amplify',
    name: 'AWS Amplify Hosting',
    category: 'Compute',
    description: 'Frontend hosting & CI/CD builds',
    icon: 'amplify',
    freeTier: { buildMinutes: 1000, storage: 5, bandwidth: 15 },
    pricing: { perBuildMinute: 0.01, perGBStored: 0.023, perGBServed: 0.15 },
    estimateMonthly: (usage) => {
      const buildCost = Math.max(0, usage.buildMinutes - 1000) * 0.01
      const storageCost = Math.max(0, usage.storageGB - 5) * 0.023
      const bandwidthCost = Math.max(0, usage.bandwidthGB - 15) * 0.15
      return buildCost + storageCost + bandwidthCost
    },
  },
  {
    id: 'lambda',
    name: 'AWS Lambda',
    category: 'Compute',
    description: '23 backend functions (arm64, 256 MB) + 1 statement parser (512 MB)',
    icon: 'lambda',
    freeTier: { requests: 1_000_000, gbSeconds: 400_000 },
    pricing: { perRequest: 0.0000002, perGBSecond: 0.0000133 },
    estimateMonthly: (usage) => {
      // Backend lambdas: 256MB, avg 200ms execution
      const backendGBs = usage.backendInvocations * 0.256 * 0.2
      // Statement parser: 512MB, avg 5s execution
      const parserGBs = usage.parserInvocations * 0.512 * 5
      const totalGBs = backendGBs + parserGBs
      const totalRequests = usage.backendInvocations + usage.parserInvocations
      const requestCost = Math.max(0, totalRequests - 1_000_000) * 0.0000002
      const computeCost = Math.max(0, totalGBs - 400_000) * 0.0000133
      return requestCost + computeCost
    },
  },
  {
    id: 'apigateway',
    name: 'API Gateway',
    category: 'Networking',
    description: 'REST API with CORS for all backend endpoints',
    icon: 'api',
    freeTier: { requests: 1_000_000 },
    pricing: { perMillionRequests: 3.50 },
    estimateMonthly: (usage) => {
      return Math.max(0, usage.apiRequests - 1_000_000) * 3.50 / 1_000_000
    },
  },
  {
    id: 'dynamodb',
    name: 'Amazon DynamoDB',
    category: 'Database',
    description: '4 tables: PlaidTokens, BurndownUsers, Organizations, OrgMembers (on-demand)',
    icon: 'dynamodb',
    freeTier: { reads: 25, writes: 25, storageGB: 25 },
    pricing: { perMillionReads: 0.25, perMillionWrites: 1.25, perGBMonth: 0.25 },
    estimateMonthly: (usage) => {
      // On-demand: $1.25 per million write request units, $0.25 per million read
      const readCost = usage.readUnits * 0.25 / 1_000_000
      const writeCost = usage.writeUnits * 1.25 / 1_000_000
      const storageCost = Math.max(0, usage.storageGB - 25) * 0.25
      return readCost + writeCost + storageCost
    },
  },
  {
    id: 's3',
    name: 'Amazon S3',
    category: 'Storage',
    description: 'Data storage, email ingestion, statement PDFs (SSE-S3 encrypted)',
    icon: 's3',
    freeTier: { storageGB: 5, putRequests: 2000, getRequests: 20000 },
    pricing: { perGBMonth: 0.023, perThousandPuts: 0.005, perThousandGets: 0.0004 },
    estimateMonthly: (usage) => {
      const storageCost = Math.max(0, usage.storageGB - 5) * 0.023
      const putCost = Math.max(0, usage.putRequests - 2000) * 0.005 / 1000
      const getCost = Math.max(0, usage.getRequests - 20000) * 0.0004 / 1000
      return storageCost + putCost + getCost
    },
  },
  {
    id: 'bedrock',
    name: 'AWS Bedrock',
    category: 'AI/ML',
    description: 'Claude 3 Haiku for credit card statement parsing',
    icon: 'bedrock',
    freeTier: {},
    pricing: { perInputToken: 0.00000025, perOutputToken: 0.00000125 },
    estimateMonthly: (usage) => {
      // Avg statement parse: ~2000 input tokens, ~500 output tokens
      const inputCost = usage.parserInvocations * 2000 * 0.00000025
      const outputCost = usage.parserInvocations * 500 * 0.00000125
      return inputCost + outputCost
    },
  },
  {
    id: 'ses',
    name: 'Amazon SES',
    category: 'Messaging',
    description: 'Inbound email receipt for statement ingestion',
    icon: 'ses',
    freeTier: { inboundEmails: 1000 },
    pricing: { perThousandInbound: 0.10 },
    estimateMonthly: (usage) => {
      return Math.max(0, usage.inboundEmails - 1000) * 0.10 / 1000
    },
  },
  {
    id: 'plaid',
    name: 'Plaid API',
    category: 'Third Party',
    description: 'Bank account linking & transaction sync (budgeted $10/mo)',
    icon: 'plaid',
    freeTier: {},
    pricing: { perCall: 0.10 },
    estimateMonthly: (usage) => {
      return usage.plaidCalls * 0.10
    },
  },
]

// Preset usage profiles
const USAGE_PROFILES = {
  minimal: {
    label: 'Minimal (1-2 users, light use)',
    buildMinutes: 50,
    storageGB: 0.5,
    bandwidthGB: 1,
    backendInvocations: 5_000,
    parserInvocations: 5,
    apiRequests: 5_000,
    readUnits: 10_000,
    writeUnits: 5_000,
    s3StorageGB: 0.1,
    putRequests: 500,
    getRequests: 2_000,
    inboundEmails: 5,
    plaidCalls: 20,
  },
  moderate: {
    label: 'Moderate (5-10 users, regular use)',
    buildMinutes: 200,
    storageGB: 1,
    bandwidthGB: 5,
    backendInvocations: 50_000,
    parserInvocations: 30,
    apiRequests: 50_000,
    readUnits: 100_000,
    writeUnits: 50_000,
    s3StorageGB: 0.5,
    putRequests: 5_000,
    getRequests: 20_000,
    inboundEmails: 30,
    plaidCalls: 60,
  },
  heavy: {
    label: 'Heavy (20+ users, active daily)',
    buildMinutes: 500,
    storageGB: 2,
    bandwidthGB: 20,
    backendInvocations: 200_000,
    parserInvocations: 100,
    apiRequests: 200_000,
    readUnits: 500_000,
    writeUnits: 200_000,
    s3StorageGB: 2,
    putRequests: 20_000,
    getRequests: 100_000,
    inboundEmails: 100,
    plaidCalls: 100,
  },
}

function getServiceIcon(icon) {
  const icons = {
    amplify: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    lambda: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 20L9.5 4h2l3 10h1.5L20 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 14L18 20H4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    api: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        <circle cx="8" cy="6" r="1.5" fill="currentColor" />
        <circle cx="14" cy="12" r="1.5" fill="currentColor" />
        <circle cx="10" cy="18" r="1.5" fill="currentColor" />
      </svg>
    ),
    dynamodb: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
        <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
      </svg>
    ),
    s3: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h16v16H4z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 9h16M9 4v16" strokeLinecap="round" />
      </svg>
    ),
    bedrock: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5.64 5.64l2.83 2.83M15.54 15.54l2.83 2.83M5.64 18.36l2.83-2.83M15.54 8.46l2.83-2.83" strokeLinecap="round" />
      </svg>
    ),
    ses: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 4L12 13 2 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    plaid: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  }
  return icons[icon] || icons.api
}

function formatUSD(n) {
  if (n < 0.01 && n > 0) return '< $0.01'
  return '$' + n.toFixed(2)
}

// Simple sparkline-style bar
function CostBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981',
        }}
      />
    </div>
  )
}

function ProjectionChart({ months }) {
  const max = Math.max(...months.map(m => m.total), 1)
  const barMaxHeight = 120

  return (
    <div className="flex items-end justify-between gap-2 px-2" style={{ height: barMaxHeight + 30 }}>
      {months.map((m) => {
        const height = (m.total / max) * barMaxHeight
        const isProjection = m.projected
        return (
          <div key={m.label} className="flex flex-col items-center flex-1">
            <span className="text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {formatUSD(m.total)}
            </span>
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height,
                background: isProjection
                  ? 'repeating-linear-gradient(135deg, var(--accent-blue) 0px, var(--accent-blue) 4px, transparent 4px, transparent 8px)'
                  : 'var(--accent-blue)',
                opacity: isProjection ? 0.6 : 1,
                minHeight: 4,
              }}
            />
            <span className="text-[10px] mt-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              {m.label}
            </span>
            {isProjection && (
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>est.</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Impersonation Panel — orgs & users with impersonate action
// ---------------------------------------------------------------------------

function ImpersonationPanel({ getToken, impersonate }) {
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
    <div>
      {/* Sub-tabs: Orgs / Users */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => { setActiveTab('orgs'); setSearch('') }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
          style={{
            background: activeTab === 'orgs' ? 'var(--accent-blue)' : 'transparent',
            color: activeTab === 'orgs' ? '#fff' : 'var(--text-secondary)',
            borderColor: activeTab === 'orgs' ? 'var(--accent-blue)' : 'var(--border-subtle)',
          }}
        >
          Organizations
          {orgs.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full"
              style={{ background: activeTab === 'orgs' ? 'rgba(255,255,255,0.2)' : 'var(--bg-input)', color: activeTab === 'orgs' ? '#fff' : 'var(--text-muted)' }}>
              {orgs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('users'); setSearch('') }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
          style={{
            background: activeTab === 'users' ? 'var(--accent-blue)' : 'transparent',
            color: activeTab === 'users' ? '#fff' : 'var(--text-secondary)',
            borderColor: activeTab === 'users' ? 'var(--accent-blue)' : 'var(--border-subtle)',
          }}
        >
          Users
          {allUsers.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full"
              style={{ background: activeTab === 'users' ? 'rgba(255,255,255,0.2)' : 'var(--bg-input)', color: activeTab === 'users' ? '#fff' : 'var(--text-muted)' }}>
              {allUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeTab === 'orgs' ? 'Search organizations...' : 'Search users...'}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent-blue)' }} />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</p>
          <button onClick={fetchData} className="text-xs font-medium" style={{ color: 'var(--accent-blue)' }}>Retry</button>
        </div>
      ) : activeTab === 'orgs' ? (
        <ImpersonationOrgsTable
          orgs={filteredOrgs}
          expandedOrg={expandedOrg}
          orgMembers={orgMembers}
          onToggle={toggleOrg}
          onImpersonate={handleImpersonate}
        />
      ) : (
        <ImpersonationUsersTable users={filteredUsers} onImpersonate={handleImpersonate} />
      )}
    </div>
  )
}

function ImpersonationOrgsTable({ orgs, expandedOrg, orgMembers, onToggle, onImpersonate }) {
  if (orgs.length === 0) {
    return <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>No organizations found</div>
  }

  return (
    <div className="space-y-2">
      {orgs.map(org => (
        <div key={org.orgId} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <button
            onClick={() => onToggle(org.orgId)}
            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-input)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--accent-blue)' }}>
                  <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{org.name}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {org.orgId} &middot; Owner: {org.ownerId}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="transition-transform" style={{ color: 'var(--text-muted)', transform: expandedOrg === org.orgId ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {expandedOrg === org.orgId && (
            <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {orgMembers[org.orgId] ? (
                <div className="space-y-1">
                  {orgMembers[org.orgId].map(member => (
                    <div key={member.userId} className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors"
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
                          style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                          {(member.email || member.userId).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{member.email}</div>
                          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {member.role} &middot; Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onImpersonate(member.userId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                        style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                        Impersonate
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent-blue)' }} />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ImpersonationUsersTable({ users, onImpersonate }) {
  if (users.length === 0) {
    return <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>No users found</div>
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>User</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Organization</th>
            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>MFA</th>
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.userId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                    {u.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.email}</div>
                    {u.orgRole && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{u.orgRole}</span>}
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5 hidden sm:table-cell">
                {u.orgId ? (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{u.orgId}</span>
                ) : (
                  <span className="text-[11px] italic" style={{ color: 'var(--text-muted)' }}>None</span>
                )}
              </td>
              <td className="px-4 py-2.5 hidden md:table-cell">
                {u.mfaEnabled ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>Enabled</span>
                ) : (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Off</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <button
                  onClick={() => onImpersonate(u.userId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                  style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                  </svg>
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

// ---------------------------------------------------------------------------

function PlaidLimitsEditor({ getToken, onLimitsUpdated }) {
  const [limits, setLimits] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const fetchLimits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/plaid-limits`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Failed to fetch limits')
      const data = await res.json()
      setLimits(data)
      setDraft(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { fetchLimits() }, [fetchLimits])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/plaid-limits`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthlyBudget: parseFloat(draft.monthlyBudget),
          estCostPerCall: parseFloat(draft.estCostPerCall),
          maxSyncPages: parseInt(draft.maxSyncPages, 10),
          syncCooldownSeconds: parseInt(draft.syncCooldownSeconds, 10),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update limits')
      }
      const data = await res.json()
      setLimits(data.after)
      setDraft(data.after)
      setSuccess('Limits updated successfully')
      if (onLimitsUpdated) onLimitsUpdated()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const isDirty = draft && limits && (
    parseFloat(draft.monthlyBudget) !== limits.monthlyBudget ||
    parseFloat(draft.estCostPerCall) !== limits.estCostPerCall ||
    parseInt(draft.maxSyncPages, 10) !== limits.maxSyncPages ||
    parseInt(draft.syncCooldownSeconds, 10) !== limits.syncCooldownSeconds
  )

  const derivedMaxCalls = draft
    ? Math.floor(parseFloat(draft.monthlyBudget || 0) / parseFloat(draft.estCostPerCall || 1))
    : 0

  if (loading && !limits) {
    return (
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent-blue)' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>API Limit Configuration</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Adjust Plaid API rate limits and budget caps. Changes take effect immediately for all users.
          </p>
        </div>
      </div>

      {draft && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                Monthly Budget ($)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="10000"
                value={draft.monthlyBudget}
                onChange={e => setDraft({ ...draft, monthlyBudget: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                Est. Cost Per Call ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={draft.estCostPerCall}
                onChange={e => setDraft({ ...draft, estCostPerCall: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                Max Sync Pages
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                value={draft.maxSyncPages}
                onChange={e => setDraft({ ...draft, maxSyncPages: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                Sync Cooldown (seconds)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="86400"
                value={draft.syncCooldownSeconds}
                onChange={e => setDraft({ ...draft, syncCooldownSeconds: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
            Derived max calls/month: <strong style={{ color: 'var(--text-primary)' }}>{derivedMaxCalls}</strong>
            {' '}({draft.monthlyBudget ? `$${parseFloat(draft.monthlyBudget).toFixed(2)}` : '$0'} / ${draft.estCostPerCall ? `$${parseFloat(draft.estCostPerCall).toFixed(2)}` : '$0'} per call)
          </div>

          {success && (
            <div className="px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              {success}
            </div>
          )}
          {error && (
            <div className="px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: !isDirty ? 'var(--bg-input)' : saving ? 'var(--bg-input)' : 'rgba(59, 130, 246, 0.15)',
              color: !isDirty ? 'var(--text-muted)' : saving ? 'var(--text-muted)' : '#3b82f6',
              cursor: !isDirty || saving ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (isDirty && !saving) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)' }}
            onMouseLeave={e => { if (isDirty && !saving) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)' }}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border-subtle)', borderTopColor: '#3b82f6' }} />
                Saving...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Limits
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function PlaidBudgetPanel({ getToken }) {
  const [budget, setBudget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState(null)
  const [resetResult, setResetResult] = useState(null)

  const fetchBudget = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/plaid/budget`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Failed to fetch budget status')
      const data = await res.json()
      setBudget(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { fetchBudget() }, [fetchBudget])

  const handleReset = async () => {
    if (!window.confirm(
      'Are you sure you want to reset the Plaid API call counter to 0?\n\n' +
      'This is a one-time exception override. The counter tracks monthly spend against the budget cap.'
    )) return

    setResetting(true)
    setError(null)
    setResetResult(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/reset-plaid-budget`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to reset budget')
      }
      const data = await res.json()
      setResetResult(data)
      setBudget(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setResetting(false)
    }
  }

  const usagePercent = budget ? Math.min(100, (budget.used / budget.limit) * 100) : 0
  const isExhausted = budget && budget.remaining === 0

  return (
    <div className="space-y-4">
      {/* Budget Status Card */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Current Month Budget Status
          </h2>
          <button
            onClick={fetchBudget}
            disabled={loading}
            className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors"
            style={{ color: 'var(--accent-blue)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading && !budget ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent-blue)' }} />
          </div>
        ) : error && !budget ? (
          <div className="text-center py-8">
            <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</p>
            <button onClick={fetchBudget} className="text-xs font-medium" style={{ color: 'var(--accent-blue)' }}>Retry</button>
          </div>
        ) : budget ? (
          <div>
            {/* Usage bar */}
            <div className="mb-4">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className="text-3xl font-bold" style={{ color: isExhausted ? '#ef4444' : 'var(--text-primary)' }}>
                    {budget.used}
                  </span>
                  <span className="text-sm ml-1" style={{ color: 'var(--text-muted)' }}>/ {budget.limit} calls</span>
                </div>
                <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {budget.month}
                </span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${usagePercent}%`,
                    background: usagePercent >= 90 ? '#ef4444' : usagePercent >= 70 ? '#f59e0b' : '#10b981',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {budget.remaining} calls remaining
                </span>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  ${(budget.used * (budget.estCostPerCall || 0.10)).toFixed(2)} / ${(budget.budgetDollars || 10).toFixed(2)} budget
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-input)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Budget</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>${(budget.budgetDollars || 10).toFixed(2)}/mo</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-input)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Cost/Call</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>${(budget.estCostPerCall || 0.10).toFixed(2)}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-input)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Used</div>
                <div className="text-sm font-bold" style={{ color: isExhausted ? '#ef4444' : 'var(--text-primary)' }}>{budget.used} calls</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-input)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Status</div>
                <div className="text-sm font-bold" style={{ color: isExhausted ? '#ef4444' : '#10b981' }}>
                  {isExhausted ? 'Exhausted' : 'Active'}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Limits Editor Card */}
      <PlaidLimitsEditor getToken={getToken} onLimitsUpdated={fetchBudget} />

      {/* Reset Tool Card */}
      <div className="rounded-xl border p-5" style={{
        background: 'var(--bg-card)',
        borderColor: isExhausted ? '#ef4444' : 'var(--border-subtle)',
      }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Reset API Call Counter</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              One-time exception override. Resets the monthly Plaid API call counter back to 0,
              allowing additional API calls beyond the normal budget cap. This action is audit-logged.
            </p>
          </div>
        </div>

        {resetResult && (
          <div className="mb-4 px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            Budget reset successfully. Previous count: {resetResult.previousCount} &rarr; 0.
            The budget now has {resetResult.remaining}/{resetResult.limit} calls available.
          </div>
        )}

        {error && !loading && (
          <div className="mb-4 px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleReset}
          disabled={resetting || loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: resetting ? 'var(--bg-input)' : 'rgba(239, 68, 68, 0.15)',
            color: resetting ? 'var(--text-muted)' : '#ef4444',
            cursor: resetting ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => { if (!resetting) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)' }}
          onMouseLeave={e => { if (!resetting) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)' }}
        >
          {resetting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4" style={{ borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border-subtle)', borderTopColor: '#ef4444' }} />
              Resetting...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              Reset Call Counter to 0
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function SuperAdminToolsPage() {
  const { user, getToken, impersonate } = useAuth()
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(user?.isSuperAdmin ? 'impersonation' : 'costs')
  const [usageProfile, setUsageProfile] = useState('minimal')
  const [growthRate, setGrowthRate] = useState(10)
  const [expandedService, setExpandedService] = useState(null)

  const usage = USAGE_PROFILES[usageProfile]

  // Calculate costs per service
  const serviceCosts = useMemo(() => {
    return AWS_SERVICES.map(service => {
      const usageMap = {
        buildMinutes: usage.buildMinutes,
        storageGB: service.id === 's3' ? usage.s3StorageGB : usage.storageGB,
        bandwidthGB: usage.bandwidthGB,
        backendInvocations: usage.backendInvocations,
        parserInvocations: usage.parserInvocations,
        apiRequests: usage.apiRequests,
        readUnits: usage.readUnits,
        writeUnits: usage.writeUnits,
        putRequests: usage.putRequests,
        getRequests: usage.getRequests,
        inboundEmails: usage.inboundEmails,
        plaidCalls: usage.plaidCalls,
      }
      const monthlyCost = service.estimateMonthly(usageMap)
      return { ...service, monthlyCost }
    })
  }, [usage])

  const totalMonthly = useMemo(() => serviceCosts.reduce((sum, s) => sum + s.monthlyCost, 0), [serviceCosts])
  const maxServiceCost = useMemo(() => Math.max(...serviceCosts.map(s => s.monthlyCost), 0.01), [serviceCosts])

  // 3-month projection with growth
  const projectionMonths = useMemo(() => {
    const now = new Date()
    const months = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      const growthMultiplier = Math.pow(1 + growthRate / 100, i)
      months.push({
        label,
        total: totalMonthly * growthMultiplier,
        projected: i > 0,
      })
    }
    return months
  }, [totalMonthly, growthRate])

  // Cost by category
  const categoryBreakdown = useMemo(() => {
    const cats = {}
    serviceCosts.forEach(s => {
      if (!cats[s.category]) cats[s.category] = 0
      cats[s.category] += s.monthlyCost
    })
    return Object.entries(cats).sort((a, b) => b[1] - a[1])
  }, [serviceCosts])

  if (user?.orgRole !== 'owner' && !user?.isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
        <div className="text-center">
          <div className="text-4xl mb-4">&#x1f512;</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Access Denied</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Superadmin tools are only available to organization owners.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent-blue)' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-5xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Superadmin Tools
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {activeSection === 'impersonation' ? 'View as any user to debug and support'
                : activeSection === 'plaidBudget' ? 'Monitor and manage Plaid API call budget'
                : 'AWS infrastructure cost analysis & projections'}
            </p>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-6">
          {user?.isSuperAdmin && (
            <button
              onClick={() => setActiveSection('impersonation')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
              style={{
                background: activeSection === 'impersonation' ? 'var(--accent-blue)' : 'transparent',
                color: activeSection === 'impersonation' ? '#fff' : 'var(--text-secondary)',
                borderColor: activeSection === 'impersonation' ? 'var(--accent-blue)' : 'var(--border-subtle)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
              User Impersonation
            </button>
          )}
          <button
            onClick={() => setActiveSection('costs')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
            style={{
              background: activeSection === 'costs' ? 'var(--accent-blue)' : 'transparent',
              color: activeSection === 'costs' ? '#fff' : 'var(--text-secondary)',
              borderColor: activeSection === 'costs' ? 'var(--accent-blue)' : 'var(--border-subtle)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Cost Analysis
          </button>
          {user?.isSuperAdmin && (
            <button
              onClick={() => setActiveSection('plaidBudget')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
              style={{
                background: activeSection === 'plaidBudget' ? 'var(--accent-blue)' : 'transparent',
                color: activeSection === 'plaidBudget' ? '#fff' : 'var(--text-secondary)',
                borderColor: activeSection === 'plaidBudget' ? 'var(--accent-blue)' : 'var(--border-subtle)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              Plaid Budget
            </button>
          )}
        </div>

        {/* Impersonation Panel */}
        {activeSection === 'impersonation' && user?.isSuperAdmin && (
          <ImpersonationPanel getToken={getToken} impersonate={impersonate} />
        )}

        {/* Plaid Budget Panel */}
        {activeSection === 'plaidBudget' && user?.isSuperAdmin && (
          <PlaidBudgetPanel getToken={getToken} />
        )}

        {/* Cost Analysis Content */}
        {activeSection === 'costs' && (<>

        {/* Usage Profile Selector */}
        <div className="rounded-xl border p-5 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
                Usage Profile
              </label>
              <div className="flex gap-2">
                {Object.entries(USAGE_PROFILES).map(([key]) => (
                  <button
                    key={key}
                    onClick={() => setUsageProfile(key)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                    style={{
                      background: usageProfile === key ? 'var(--accent-blue)' : 'transparent',
                      color: usageProfile === key ? '#fff' : 'var(--text-secondary)',
                      borderColor: usageProfile === key ? 'var(--accent-blue)' : 'var(--border-subtle)',
                    }}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                {usage.label}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-secondary)' }}>
                Monthly Growth Rate
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={growthRate}
                  onChange={e => setGrowthRate(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm font-mono w-10 text-right" style={{ color: 'var(--text-primary)' }}>
                  {growthRate}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Current Month
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatUSD(totalMonthly)}
            </div>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Next Month (est.)
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--accent-blue)' }}>
              {formatUSD(projectionMonths[1]?.total || 0)}
            </div>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              3-Month Total (est.)
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatUSD(projectionMonths.slice(1, 4).reduce((s, m) => s + m.total, 0))}
            </div>
          </div>
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              Annual Projection
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {formatUSD(totalMonthly * 12 * (growthRate > 0 ? (Math.pow(1 + growthRate / 100, 12) - 1) / (growthRate / 100) / 12 : 1))}
            </div>
          </div>
        </div>

        {/* Projection Chart */}
        <div className="rounded-xl border p-5 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
            6-Month Cost Projection
          </h2>
          <ProjectionChart months={projectionMonths} />
          <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
            Solid = current &middot; Hatched = projected at {growthRate}% monthly growth
          </p>
        </div>

        {/* Category Breakdown */}
        <div className="rounded-xl border p-5 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
            Cost by Category
          </h2>
          <div className="space-y-3">
            {categoryBreakdown.map(([category, cost]) => (
              <div key={category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{category}</span>
                  <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{formatUSD(cost)}/mo</span>
                </div>
                <CostBar value={cost} max={totalMonthly || 0.01} />
              </div>
            ))}
          </div>
        </div>

        {/* Service-by-Service Breakdown */}
        <div className="rounded-xl border p-5 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
            Service Breakdown
          </h2>
          <div className="space-y-2">
            {serviceCosts.sort((a, b) => b.monthlyCost - a.monthlyCost).map(service => (
              <div key={service.id}>
                <button
                  onClick={() => setExpandedService(expandedService === service.id ? null : service.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                  style={{ background: expandedService === service.id ? 'var(--bg-input)' : 'transparent' }}
                  onMouseEnter={e => { if (expandedService !== service.id) e.currentTarget.style.background = 'var(--bg-input)' }}
                  onMouseLeave={e => { if (expandedService !== service.id) e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="flex-shrink-0" style={{ color: 'var(--accent-blue)' }}>
                    {getServiceIcon(service.icon)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {service.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--bg-page)', color: 'var(--text-muted)' }}
                      >
                        {service.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex-1">
                        <CostBar value={service.monthlyCost} max={maxServiceCost} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                      {formatUSD(service.monthlyCost)}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>/mo</div>
                  </div>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className="flex-shrink-0 transition-transform"
                    style={{
                      color: 'var(--text-muted)',
                      transform: expandedService === service.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {expandedService === service.id && (
                  <div
                    className="mx-3 mb-2 px-4 py-3 rounded-lg text-xs space-y-2"
                    style={{ background: 'var(--bg-page)', color: 'var(--text-secondary)' }}
                  >
                    <p>{service.description}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <div>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly cost: </span>
                        {formatUSD(service.monthlyCost)}
                      </div>
                      <div>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Annual est.: </span>
                        {formatUSD(service.monthlyCost * 12)}
                      </div>
                      {Object.keys(service.freeTier).length > 0 && (
                        <div className="col-span-2 mt-1">
                          <span className="font-semibold" style={{ color: '#10b981' }}>Free tier: </span>
                          {Object.entries(service.freeTier).map(([k, v]) =>
                            `${v.toLocaleString()} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`
                          ).join(', ')}
                        </div>
                      )}
                    </div>
                    {service.id === 'plaid' && (
                      <div className="mt-2 px-3 py-2 rounded-md" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                        Budget cap: $10.00/mo ({Math.floor(10 / 0.10)} calls max). This is enforced server-side.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3-Month Detailed Projection Table */}
        <div className="rounded-xl border p-5 mb-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
            3-Month Estimated Cost Detail
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>Service</th>
                  {projectionMonths.slice(0, 4).map(m => (
                    <th key={m.label} className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {m.label}
                    </th>
                  ))}
                  <th className="text-right py-2 pl-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>3-Mo Total</th>
                </tr>
              </thead>
              <tbody>
                {serviceCosts.sort((a, b) => b.monthlyCost - a.monthlyCost).map(service => {
                  const monthCosts = projectionMonths.slice(0, 4).map((m, i) => {
                    const mult = Math.pow(1 + growthRate / 100, i)
                    // Plaid has a hard budget cap
                    if (service.id === 'plaid') return Math.min(service.monthlyCost * mult, 10)
                    return service.monthlyCost * mult
                  })
                  const threeMonthTotal = monthCosts.slice(1).reduce((s, c) => s + c, 0)
                  return (
                    <tr key={service.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="py-2 pr-4" style={{ color: 'var(--text-primary)' }}>{service.name}</td>
                      {monthCosts.map((cost, i) => (
                        <td key={i} className="text-right py-2 px-2 font-mono" style={{ color: i === 0 ? 'var(--text-primary)' : 'var(--accent-blue)' }}>
                          {formatUSD(cost)}
                        </td>
                      ))}
                      <td className="text-right py-2 pl-4 font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatUSD(threeMonthTotal)}
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td className="py-2 pr-4 font-bold" style={{ color: 'var(--text-primary)' }}>Total</td>
                  {projectionMonths.slice(0, 4).map((m, i) => (
                    <td key={m.label} className="text-right py-2 px-2 font-mono font-bold" style={{ color: i === 0 ? 'var(--text-primary)' : 'var(--accent-blue)' }}>
                      {formatUSD(m.total)}
                    </td>
                  ))}
                  <td className="text-right py-2 pl-4 font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatUSD(projectionMonths.slice(1, 4).reduce((s, m) => s + m.total, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Infrastructure Notes */}
        <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-secondary)' }}>
            Cost Optimization Notes
          </h2>
          <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-start gap-2">
              <span style={{ color: '#10b981' }}>&#x2713;</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>ARM64 Lambda</strong> &mdash; All functions use Graviton2 (arm64) for ~20% cost savings vs x86</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#10b981' }}>&#x2713;</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>DynamoDB On-Demand</strong> &mdash; Pay-per-request billing eliminates idle capacity costs</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#10b981' }}>&#x2713;</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>Plaid Budget Cap</strong> &mdash; Server-side enforcement limits API spend to $10/month max</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#10b981' }}>&#x2713;</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>S3 Encryption</strong> &mdash; SSE-S3 (AES256) at no additional cost</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#f59e0b' }}>!</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>Bedrock (Claude 3 Haiku)</strong> &mdash; Per-token pricing; costs scale with statement parsing volume</span>
            </div>
            <div className="flex items-start gap-2">
              <span style={{ color: '#f59e0b' }}>!</span>
              <span><strong style={{ color: 'var(--text-primary)' }}>Free Tier</strong> &mdash; Many services stay within AWS free tier at low usage. Free tier expires 12 months after account creation</span>
            </div>
          </div>
        </div>

        </>)}
      </div>
    </div>
  )
}
