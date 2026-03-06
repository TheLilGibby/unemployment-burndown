import { useState } from 'react'

function formatCurrency(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Never'
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Displays connected SnapTrade investment accounts with holdings.
 * Shows account summaries, individual holdings, and sync/disconnect controls.
 */
export default function SnapTradeAccountsPanel({ accounts, syncing, lastSync, onSync, onDisconnect }) {
  const [expandedAccount, setExpandedAccount] = useState(null)

  if (!accounts || accounts.length === 0) return null

  const totalValue = accounts.reduce((sum, a) => sum + (a.totalValue || 0), 0)

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className="rounded-lg px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#10b981' }}>
            Investment Accounts
          </div>
          <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(totalValue)}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} via SnapTrade
            {lastSync && <> &middot; Synced {timeAgo(lastSync)}</>}
          </div>
        </div>
        <button
          onClick={() => onSync?.()}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors"
          style={{
            background: syncing ? 'var(--bg-input)' : 'rgba(16, 185, 129, 0.15)',
            color: syncing ? 'var(--text-muted)' : '#10b981',
            cursor: syncing ? 'not-allowed' : 'pointer',
          }}
        >
          {syncing ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3" style={{ borderWidth: 1.5, borderStyle: 'solid', borderColor: 'var(--border-subtle)', borderTopColor: '#10b981' }} />
              Syncing...
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              Sync
            </>
          )}
        </button>
      </div>

      {/* Account cards */}
      {accounts.map(account => (
        <div
          key={account.id}
          className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <button
            onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}
            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 12h5l3-9 4 18 3-9h5" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{account.name}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {account.institution} &middot; {account.number || account.type}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(account.totalValue)}
                </div>
                {account.holdings?.length > 0 && (
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {account.holdings.length} holding{account.holdings.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="transition-transform" style={{ color: 'var(--text-muted)', transform: expandedAccount === account.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {/* Expanded holdings */}
          {expandedAccount === account.id && (
            <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {account.cashBalance != null && account.cashBalance > 0 && (
                <div className="flex items-center justify-between py-2 text-xs" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Cash Balance</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(account.cashBalance)}</span>
                </div>
              )}

              {account.holdings?.length > 0 && (
                <div className="mt-2">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 text-[11px]">
                    <div className="font-semibold uppercase tracking-wider pb-1" style={{ color: 'var(--text-muted)' }}>Symbol</div>
                    <div className="font-semibold uppercase tracking-wider pb-1 text-right" style={{ color: 'var(--text-muted)' }}>Qty</div>
                    <div className="font-semibold uppercase tracking-wider pb-1 text-right" style={{ color: 'var(--text-muted)' }}>Price</div>
                    <div className="font-semibold uppercase tracking-wider pb-1 text-right" style={{ color: 'var(--text-muted)' }}>Value</div>
                    {account.holdings.map((h, i) => (
                      <div key={i} className="contents">
                        <div style={{ color: 'var(--text-primary)' }}>
                          <span className="font-semibold">{h.symbol}</span>
                          <span className="ml-1.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{h.name}</span>
                        </div>
                        <div className="text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{h.quantity}</div>
                        <div className="text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(h.price)}</div>
                        <div className="text-right font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(h.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {onDisconnect && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => {
                      if (window.confirm(`Disconnect ${account.name}? This will remove the brokerage link.`)) {
                        onDisconnect(account.id)
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
