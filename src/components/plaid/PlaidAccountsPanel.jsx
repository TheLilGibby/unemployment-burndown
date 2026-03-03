import { useEffect } from 'react'
import PlaidLinkButton from './PlaidLinkButton'
import { formatCurrency } from '../../utils/formatters'

const TYPE_LABELS = {
  depository: 'Bank',
  credit: 'Credit',
  investment: 'Investment',
  loan: 'Loan',
  brokerage: 'Brokerage',
}

const TYPE_COLORS = {
  depository: 'var(--accent-emerald)',
  credit: 'var(--accent-orange, #f97316)',
  investment: 'var(--accent-teal)',
  loan: 'var(--accent-red, #ef4444)',
}

function timeAgo(iso) {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function PlaidAccountsPanel({
  plaidAccounts,
  linkToken,
  linking,
  syncing,
  error,
  onCreateLinkToken,
  onLinkSuccess,
  onSyncBalances,
  onSyncAll,
  onFetchTransactions,
  fetchingTxns,
  onUnlink,
  onMapAccount,
  onToggleAutoSync,
  savingsAccounts = [],
  creditCards = [],
  investments = [],
}) {
  // Auto-create link token on mount
  useEffect(() => {
    if (!linkToken) onCreateLinkToken()
  }, []) // eslint-disable-line

  // Build mapping options grouped by type
  const mappingOptions = [
    { label: 'Savings Accounts', type: 'savingsAccounts', items: savingsAccounts.map(s => ({ id: s.id, name: s.name })) },
    { label: 'Credit Cards', type: 'creditCards', items: creditCards.map(c => ({ id: c.id, name: c.name })) },
    { label: 'Investments', type: 'investments', items: investments.map(i => ({ id: i.id, name: i.name })) },
  ]

  if (plaidAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }}>
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>No bank accounts linked</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Link your bank to auto-sync balances and import transactions
          </p>
          <PlaidLinkButton
            linkToken={linkToken}
            onSuccess={onLinkSuccess}
            disabled={linking}
          />
        </div>
        {error && (
          <p className="text-xs text-center" style={{ color: 'var(--accent-red, #ef4444)' }}>{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <PlaidLinkButton
          linkToken={linkToken}
          onSuccess={onLinkSuccess}
          disabled={linking}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={onSyncAll}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--bg-input)',
              color: syncing ? 'var(--text-muted)' : 'var(--accent-emerald)',
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={syncing ? 'animate-spin' : ''}
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync All'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs px-2" style={{ color: 'var(--accent-red, #ef4444)' }}>{error}</p>
      )}

      {/* Linked institutions */}
      {plaidAccounts.map(item => (
        <div
          key={item.id}
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {/* Institution header */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ background: 'var(--bg-input)' }}
          >
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-blue)' }}>
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {item.institutionName}
              </span>
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
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                synced {timeAgo(item.lastSynced)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSyncBalances(item.id)}
                disabled={syncing}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: 'var(--accent-emerald)' }}
                title="Sync balances"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={syncing ? 'animate-spin' : ''}>
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              </button>
              <button
                onClick={() => onFetchTransactions(item.id)}
                disabled={fetchingTxns}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{ color: 'var(--accent-blue)' }}
                title="Import transactions"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </button>
              <button
                onClick={() => onUnlink(item.id)}
                className="text-xs px-2 py-1 rounded transition-colors hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
                title="Unlink institution"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Accounts list */}
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {item.accounts.map(acc => {
              const typeColor = TYPE_COLORS[acc.type] || 'var(--text-muted)'
              const typeLabel = TYPE_LABELS[acc.type] || acc.type

              return (
                <div
                  key={acc.plaidAccountId}
                  className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  {/* Account info */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                      style={{ background: `color-mix(in srgb, ${typeColor} 15%, transparent)`, color: typeColor }}
                    >
                      {typeLabel}
                    </span>
                    <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {acc.name}
                    </span>
                    {acc.mask && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ****{acc.mask}
                      </span>
                    )}
                  </div>

                  {/* Balance */}
                  <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(Math.abs(acc.currentBalance || 0))}
                  </div>

                  {/* Mapping dropdown */}
                  <select
                    value={acc.mappedTo ? `${acc.mappedTo.type}:${acc.mappedTo.localId}` : ''}
                    onChange={e => {
                      const val = e.target.value
                      if (!val) {
                        onMapAccount(item.id, acc.plaidAccountId, null, null)
                      } else {
                        const [type, id] = val.split(':')
                        onMapAccount(item.id, acc.plaidAccountId, type, Number(id))
                      }
                    }}
                    className="text-xs rounded-md px-2 py-1 border"
                    style={{
                      background: 'var(--bg-input)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      maxWidth: 160,
                    }}
                  >
                    <option value="">Not mapped</option>
                    {mappingOptions.map(group => (
                      group.items.length > 0 && (
                        <optgroup key={group.type} label={group.label}>
                          {group.items.map(opt => (
                            <option key={`${group.type}:${opt.id}`} value={`${group.type}:${opt.id}`}>
                              {opt.name}
                            </option>
                          ))}
                        </optgroup>
                      )
                    ))}
                  </select>

                  {/* Auto-sync toggle */}
                  <button
                    onClick={() => onToggleAutoSync(item.id, acc.plaidAccountId)}
                    className="text-[10px] font-semibold uppercase px-2 py-1 rounded transition-colors"
                    style={{
                      background: acc.autoSync
                        ? 'color-mix(in srgb, var(--accent-emerald) 15%, transparent)'
                        : 'var(--bg-input)',
                      color: acc.autoSync ? 'var(--accent-emerald)' : 'var(--text-muted)',
                      border: '1px solid',
                      borderColor: acc.autoSync ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                    }}
                    title={acc.autoSync ? 'Auto-sync enabled — click to disable' : 'Auto-sync disabled — click to enable'}
                  >
                    {acc.autoSync ? 'Auto' : 'Manual'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
