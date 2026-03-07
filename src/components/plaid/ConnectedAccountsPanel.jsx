import { useEffect } from 'react'
import { formatCurrency } from '../../utils/formatters'
import { SkeletonLine, SkeletonStyles } from '../common/Skeleton'

/**
 * Displays connected Plaid institutions and their accounts.
 *
 * Props:
 *   linkedItems  – array of { itemId, institutionName, accounts[], lastSync, connectedBy?, error? }
 *   syncing      – boolean
 *   lastSync     – ISO timestamp of last successful sync
 *   error        – string or null
 *   loading      – boolean, true during initial fetch
 *   fetchAccounts – async fn() to load connected accounts
 *   syncAll      – async fn(itemId?) to trigger sync
 *   disconnect   – async fn(itemId) to remove a connection
 *   hasFetched   – boolean, whether initial fetch has completed
 */
export default function ConnectedAccountsPanel({
  linkedItems = [],
  syncing,
  lastSync,
  error,
  loading,
  fetchAccounts,
  syncAll,
  disconnect,
  hasFetched,
}) {
  // Auto-fetch on mount
  useEffect(() => {
    if (!hasFetched && fetchAccounts) {
      fetchAccounts()
    }
  }, [hasFetched, fetchAccounts])

  if (!hasFetched && loading) {
    return (
      <div className="space-y-3">
        <SkeletonStyles />
        {[1, 2].map(i => (
          <div
            key={i}
            className="rounded-xl border"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)' }}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <SkeletonLine width="1.25rem" height="1.25rem" style={{ borderRadius: '0.375rem' }} />
                <div>
                  <SkeletonLine width="8rem" height="0.65rem" style={{ marginBottom: '0.35rem' }} />
                  <SkeletonLine width="5rem" height="0.45rem" />
                </div>
              </div>
              <SkeletonLine width="3rem" height="1.5rem" style={{ borderRadius: '0.375rem' }} />
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {[1, 2].map(j => (
                <div key={j} className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    <SkeletonLine width="1rem" height="1rem" style={{ borderRadius: '0.25rem' }} />
                    <div>
                      <SkeletonLine width={`${5 + Math.random() * 4}rem`} height="0.6rem" style={{ marginBottom: '0.3rem' }} />
                      <SkeletonLine width="4rem" height="0.45rem" />
                    </div>
                  </div>
                  <SkeletonLine width="3.5rem" height="0.65rem" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Filter out depository accounts — those are shown in the unified Cash & Savings section
  const filteredItems = linkedItems.map(item => ({
    ...item,
    accounts: (item.accounts || []).filter(a => a.type !== 'depository'),
    hasDepositoryAccounts: (item.accounts || []).some(a => a.type === 'depository'),
  }))
  // Only show institutions that still have non-depository accounts
  const visibleItems = filteredItems.filter(item => item.accounts.length > 0)
  const allDepositoryOnly = linkedItems.length > 0 && visibleItems.length === 0

  if (linkedItems.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No bank accounts connected yet. Click <strong>Connect Bank</strong> in the header to link your accounts via Plaid.
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
          Plaid securely connects to your bank. Your credentials are never stored by this app.
        </p>
      </div>
    )
  }

  if (allDepositoryOnly) {
    return (
      <div className="text-center py-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Your connected bank accounts are shown in the <strong>Cash & Savings</strong> section above.
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
          Credit cards, investment, and loan accounts from connected banks will appear here.
        </p>
      </div>
    )
  }

  const acctTypeIcon = (type) => {
    switch (type) {
      case 'depository': return '🏦'
      case 'credit':     return '💳'
      case 'investment': return '📈'
      case 'loan':       return '📋'
      default:           return '🔗'
    }
  }

  const formatTime = (iso) => {
    if (!iso) return 'Never'
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.round((now - d) / 60000)
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.round(diff / 60)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-3">
      {error && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', color: '#f87171' }}
        >
          {error}
        </div>
      )}

      {visibleItems.map(item => (
        <div
          key={item.itemId}
          className="rounded-xl border"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)' }}
        >
          {/* Institution header */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base flex-shrink-0">🏛️</span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.institutionName || 'Connected Bank'}
                  </p>
                  {item.connectedBy && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
                        color: 'var(--accent-blue)',
                        border: '1px solid color-mix(in srgb, var(--accent-blue) 20%, transparent)',
                        maxWidth: '10rem',
                      }}
                      title={`Connected by ${item.connectedBy}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span className="truncate">{item.connectedBy}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Synced {formatTime(item.lastSync || lastSync)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => syncAll(item.itemId)}
                disabled={syncing}
                className="text-xs px-2 py-1 rounded-md border transition-colors"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: syncing ? 'var(--text-muted)' : 'var(--accent-blue)',
                  background: 'transparent',
                  cursor: syncing ? 'wait' : 'pointer',
                }}
              >
                {syncing ? '⟳ Syncing...' : '⟳ Sync'}
              </button>
              <button
                onClick={() => disconnect(item.itemId)}
                className="text-xs px-2 py-1 rounded-md border transition-colors"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-muted)',
                  background: 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Disconnect this bank"
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Account list */}
          {item.accounts && item.accounts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {item.accounts.map(acct => (
                <div
                  key={acct.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm flex-shrink-0">{acctTypeIcon(acct.type)}</span>
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {acct.officialName || acct.name}
                        {acct.mask && <span style={{ color: 'var(--text-muted)' }}> ••{acct.mask}</span>}
                      </p>
                      <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                        {acct.subtype || acct.type}
                        {acct.type === 'depository' && ' → Savings'}
                        {acct.type === 'credit' && ' → Credit Cards'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-semibold tabular-nums" style={{
                      color: acct.type === 'credit' ? '#f87171' : 'var(--accent-emerald)',
                    }}>
                      {acct.type === 'credit' ? '-' : ''}{formatCurrency(Math.abs(acct.currentBalance ?? 0))}
                    </p>
                    {acct.limit != null && acct.limit > 0 && (
                      <p className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        / {formatCurrency(acct.limit)} limit
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {item.error && (
            <div className="px-3 py-2 text-xs" style={{ color: '#fb923c', borderTop: '1px solid var(--border-subtle)' }}>
              ⚠ {item.error}
            </div>
          )}
        </div>
      ))}

      {/* Sync all button */}
      {visibleItems.length > 1 && (
        <button
          onClick={() => syncAll()}
          disabled={syncing}
          className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
          style={{
            borderColor: 'var(--border-subtle)',
            color: syncing ? 'var(--text-muted)' : 'var(--accent-blue)',
            cursor: syncing ? 'wait' : 'pointer',
          }}
        >
          {syncing ? 'Syncing all accounts...' : '⟳ Sync All Accounts'}
        </button>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Connected via <strong>Plaid</strong>. Balances auto-update your Cash & Savings and Credit Cards sections.
        Syncing pulls latest balances and categorized transactions from your bank.
      </p>
    </div>
  )
}
