import { useEffect, useState, useCallback } from 'react'
import { formatCurrency } from '../../utils/formatters'
import { SkeletonLine, SkeletonStyles } from '../common/Skeleton'
import { classifyConnectionError } from '../../utils/connectionErrors'

/**
 * Displays connected SnapTrade brokerages, accounts, and holdings.
 *
 * Props:
 *   connections   – array of { connectionId, brokerageName, accounts[], lastSync }
 *   syncing       – boolean
 *   lastSync      – ISO timestamp of last successful sync
 *   error         – string or null
 *   loading       – boolean
 *   fetchAccounts – async fn()
 *   syncAll       – async fn(connectionId?)
 *   disconnect    – async fn(connectionId)
 *   hasFetched    – boolean
 */
export default function ConnectedBrokeragesPanel({
  connections = [],
  syncing,
  lastSync,
  error,
  loading,
  fetchAccounts,
  syncAll,
  disconnect,
  hasFetched,
  reconnect,
}) {
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
          </div>
        ))}
      </div>
    )
  }

  if (connections.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No brokerage accounts connected yet. Click <strong>Connect Brokerage</strong> in the header to link your investment accounts via SnapTrade.
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
          SnapTrade securely connects to brokerages like Fidelity, Schwab, and Vanguard. Your credentials are never stored by this app.
        </p>
      </div>
    )
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

      {connections.map(conn => (
        <BrokerageCard
          key={conn.connectionId}
          conn={conn}
          lastSync={lastSync}
          syncing={syncing}
          syncAll={syncAll}
          disconnect={disconnect}
          reconnect={reconnect}
          fetchAccounts={fetchAccounts}
          formatTime={formatTime}
        />
      ))}

      {connections.length > 1 && (
        <button
          onClick={() => syncAll()}
          disabled={syncing}
          className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
          style={{
            borderColor: 'var(--border-subtle)',
            color: syncing ? 'var(--text-muted)' : 'var(--accent-teal, #14b8a6)',
            cursor: syncing ? 'wait' : 'pointer',
          }}
        >
          {syncing ? 'Syncing all brokerages...' : 'Sync All Brokerages'}
        </button>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Connected via <strong>SnapTrade</strong>. Holdings and balances auto-update your Investments section.
      </p>
    </div>
  )
}

function BrokerageCard({ conn, lastSync, syncing, syncAll, disconnect, reconnect, fetchAccounts, formatTime }) {
  const [expanded, setExpanded] = useState(null) // accountId or null
  const [reconnecting, setReconnecting] = useState(false)

  const handleReconnect = useCallback(async () => {
    if (!reconnect) return
    setReconnecting(true)
    try {
      await reconnect(conn.connectionId)
    } catch {
      // Error surfaced via useSnapTrade error state
    }
    setReconnecting(false)
  }, [reconnect, conn.connectionId])

  return (
    <div
      className="rounded-xl border"
      style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)' }}
    >
      {/* Brokerage header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">📊</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {conn.brokerageName || 'Connected Brokerage'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Synced {formatTime(conn.lastSync || lastSync)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => syncAll(conn.connectionId)}
            disabled={syncing}
            className="text-xs px-2 py-1 rounded-md border transition-colors"
            style={{
              borderColor: 'var(--border-subtle)',
              color: syncing ? 'var(--text-muted)' : 'var(--accent-teal, #14b8a6)',
              background: 'transparent',
              cursor: syncing ? 'wait' : 'pointer',
            }}
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => disconnect(conn.connectionId)}
            className="text-xs px-2 py-1 rounded-md border transition-colors"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)',
              background: 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            title="Disconnect this brokerage"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Account list */}
      {conn.accounts && conn.accounts.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {conn.accounts.map(acct => (
            <div key={acct.id}>
              <div
                className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                onClick={() => setExpanded(expanded === acct.id ? null : acct.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm flex-shrink-0">📈</span>
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {acct.name}
                      {acct.number && <span style={{ color: 'var(--text-muted)' }}> ••{acct.number.slice(-4)}</span>}
                    </p>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                      {acct.type || 'Investment'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--accent-teal, #14b8a6)' }}>
                    {acct.balance != null ? formatCurrency(acct.balance) : '--'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {acct.currency || 'USD'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {conn.error && (() => {
        const classified = classifyConnectionError(conn.error)
        const canReconnect = classified?.canReconnect && reconnect
        const color = classified?.severity === 'institution_down' || classified?.severity === 'rate_limited'
          ? '#fbbf24'
          : '#fb923c'
        return (
          <div
            className="px-3 py-2 flex items-center justify-between gap-2"
            style={{ color, borderTop: '1px solid var(--border-subtle)' }}
          >
            <span className="text-xs">
              {classified?.severity === 'credentials_expired' && '🔑 '}
              {classified?.severity === 'institution_down' && '🏦 '}
              {classified?.severity === 'rate_limited' && '⏳ '}
              {classified?.userMessage || conn.error}
            </span>
            {canReconnect && (
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="text-xs px-2 py-1 rounded-md border transition-colors flex-shrink-0"
                style={{
                  borderColor: 'var(--accent-teal, #14b8a6)',
                  color: 'var(--accent-teal, #14b8a6)',
                  background: 'rgba(20, 184, 166, 0.1)',
                  cursor: reconnecting ? 'wait' : 'pointer',
                  opacity: reconnecting ? 0.6 : 1,
                }}
              >
                {reconnecting ? 'Reconnecting...' : 'Reconnect'}
              </button>
            )}
          </div>
        )
      })()}
    </div>
  )
}
