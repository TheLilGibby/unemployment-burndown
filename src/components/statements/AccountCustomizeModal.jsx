import { useState } from 'react'
import { X, Eye, EyeOff, CreditCard, Landmark, Pencil, Check, Unplug } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

const COLOR_CLASSES = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-400',
  rose: 'bg-rose-500',
  cyan: 'bg-cyan-500',
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

function AccountCustomizeRow({ account, customization, onChange, people, isDepository, plaidInfo, onDisconnect }) {
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState(customization?.nickname || '')
  const hidden = customization?.hidden || false
  const nickname = customization?.nickname || ''
  const assignedTo = customization?.assignedTo ?? null

  const person = people.find(p => p.id === assignedTo) ?? null

  function toggleHidden() {
    onChange({ ...customization, hidden: !hidden })
  }

  function startEditing() {
    setDraftName(nickname || account.name)
    setEditingName(true)
  }

  function saveNickname() {
    const trimmed = draftName.trim()
    onChange({
      ...customization,
      nickname: trimmed === account.name ? '' : trimmed,
    })
    setEditingName(false)
  }

  function cycleAssignee() {
    if (!people.length) return
    if (assignedTo === null) {
      onChange({ ...customization, assignedTo: people[0].id })
      return
    }
    const idx = people.findIndex(p => p.id === assignedTo)
    if (idx === -1 || idx === people.length - 1) {
      onChange({ ...customization, assignedTo: null })
    } else {
      onChange({ ...customization, assignedTo: people[idx + 1].id })
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
      style={{
        background: hidden ? 'rgba(100,100,100,0.08)' : 'var(--bg-input)',
        opacity: hidden ? 0.5 : 1,
      }}
    >
      {/* Account type icon */}
      {isDepository
        ? <Landmark size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
        : <CreditCard size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
      }

      {/* Name / Nickname section */}
      <div className="flex-1 min-w-0">
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveNickname(); if (e.key === 'Escape') setEditingName(false) }}
              autoFocus
              className="text-xs bg-transparent border-b outline-none w-full"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--accent-blue)' }}
            />
            <button onClick={saveNickname} className="p-0.5 rounded" style={{ color: 'var(--accent-blue)' }}>
              <Check size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
              {nickname || account.name}
            </span>
            {nickname && (
              <span className="text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>
                ({account.name})
              </span>
            )}
            <button onClick={startEditing} className="p-0.5 rounded shrink-0 opacity-40 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}>
              <Pencil size={10} />
            </button>
          </div>
        )}
        {account.last4 && (
          <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            ••{account.last4}
          </span>
        )}
      </div>

      {/* Assignee badge */}
      <button
        type="button"
        onClick={cycleAssignee}
        title={person ? `Assigned to ${person.name} — click to change` : 'Unassigned — click to assign'}
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white transition-colors shrink-0 ${
          person ? (COLOR_CLASSES[person.color] ?? 'bg-gray-500') : ''
        }`}
        style={!person ? {
          background: 'transparent',
          border: '1px dashed var(--text-faint)',
          color: 'var(--text-faint)',
        } : undefined}
      >
        {person ? getInitials(person.name) : '+'}
      </button>

      {/* Balance */}
      <span
        className="text-xs font-semibold tabular-nums shrink-0"
        style={{ color: 'var(--text-primary)' }}
      >
        {formatCurrency(Math.abs(account.balance || account.amount || 0))}
      </span>

      {/* Hide/Show toggle */}
      <button
        onClick={toggleHidden}
        className="p-1 rounded transition-colors shrink-0"
        style={{ color: hidden ? 'var(--text-faint)' : 'var(--text-muted)' }}
        title={hidden ? 'Show account' : 'Hide account'}
      >
        {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>

      {/* Disconnect button (Plaid-linked accounts only) */}
      {plaidInfo && onDisconnect && (
        <button
          onClick={() => onDisconnect(plaidInfo)}
          className="p-1 rounded transition-colors shrink-0"
          style={{ color: 'var(--text-faint)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
          title={`Disconnect from ${plaidInfo.institutionName}`}
        >
          <Unplug size={14} />
        </button>
      )}
    </div>
  )
}

export default function AccountCustomizeModal({
  open,
  onClose,
  creditCards = [],
  bankAccounts = [],
  customizations = {},
  onCustomizationsChange,
  people = [],
  plaidAccountToItem = new Map(),
  onDisconnectAccount,
}) {
  const [tab, setTab] = useState('accounts')
  const [disconnecting, setDisconnecting] = useState(null) // { itemId, institutionName, affectedAccounts[] }
  const [disconnectLoading, setDisconnectLoading] = useState(false)
  const [disconnectError, setDisconnectError] = useState(null)

  if (!open) return null

  function handleChange(accountId, patch) {
    onCustomizationsChange({
      ...customizations,
      [accountId]: { ...(customizations[accountId] || {}), ...patch },
    })
  }

  function handleInitiateDisconnect(plaidInfo) {
    setDisconnectError(null)
    setDisconnecting({
      itemId: plaidInfo.itemId,
      institutionName: plaidInfo.institutionName,
      affectedAccounts: plaidInfo.siblingAccounts || [],
    })
  }

  async function handleConfirmDisconnect(removeData) {
    if (!disconnecting || !onDisconnectAccount) return
    setDisconnectLoading(true)
    setDisconnectError(null)
    try {
      await onDisconnectAccount({ itemId: disconnecting.itemId, removeData })
      setDisconnecting(null)
    } catch (e) {
      setDisconnectError(e.message || 'Failed to disconnect account')
    } finally {
      setDisconnectLoading(false)
    }
  }

  const hiddenCount = Object.values(customizations).filter(c => c.hidden).length

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Customize accounts
          </h2>
          <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
          {['accounts', 'display'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2 text-xs font-medium transition-colors"
              style={{
                color: tab === t ? 'var(--accent-blue)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent-blue)' : '2px solid transparent',
              }}
            >
              {t === 'accounts' ? 'Accounts' : 'Display preferences'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-4 py-3 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 8rem)', scrollbarWidth: 'thin' }}>
          {tab === 'accounts' ? (
            disconnecting ? (
              /* ── Disconnect confirmation panel ── */
              <div className="space-y-4">
                <div className="text-center py-2">
                  <div
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-3"
                    style={{ background: 'rgba(248, 113, 113, 0.12)' }}
                  >
                    <Unplug size={20} style={{ color: '#f87171' }} />
                  </div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Disconnect {disconnecting.institutionName}?
                  </h3>
                  {disconnecting.affectedAccounts.length > 1 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      This will disconnect all accounts from this institution
                    </p>
                  )}
                </div>

                {/* List affected accounts */}
                {disconnecting.affectedAccounts.length > 0 && (
                  <div
                    className="rounded-lg px-3 py-2 space-y-1"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Affected accounts
                    </span>
                    {disconnecting.affectedAccounts.map(acct => (
                      <div key={acct.id} className="flex items-center justify-between py-1">
                        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                          {acct.officialName || acct.name}
                          {acct.mask && <span style={{ color: 'var(--text-faint)' }}> ••{acct.mask}</span>}
                        </span>
                        <span className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>
                          {acct.subtype || acct.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {disconnectError && (
                  <div
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', color: '#f87171' }}
                  >
                    {disconnectError}
                  </div>
                )}

                {/* Data choice buttons */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleConfirmDisconnect(true)}
                    disabled={disconnectLoading}
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors"
                    style={{
                      background: disconnectLoading ? 'rgba(248, 113, 113, 0.4)' : '#f87171',
                      color: '#fff',
                      cursor: disconnectLoading ? 'wait' : 'pointer',
                    }}
                  >
                    {disconnectLoading ? 'Disconnecting...' : 'Disconnect & Remove All Data'}
                  </button>
                  <p className="text-[10px] text-center" style={{ color: 'var(--text-faint)' }}>
                    Removes the connection and deletes all related accounts, balances, and customizations
                  </p>

                  <button
                    onClick={() => handleConfirmDisconnect(false)}
                    disabled={disconnectLoading}
                    className="w-full px-4 py-2.5 text-xs font-semibold rounded-lg border transition-colors"
                    style={{
                      background: 'transparent',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)',
                      cursor: disconnectLoading ? 'wait' : 'pointer',
                      opacity: disconnectLoading ? 0.5 : 1,
                    }}
                  >
                    {disconnectLoading ? 'Disconnecting...' : 'Disconnect & Keep Records'}
                  </button>
                  <p className="text-[10px] text-center" style={{ color: 'var(--text-faint)' }}>
                    Removes the live connection but retains existing data for historical reference
                  </p>
                </div>

                <button
                  onClick={() => { setDisconnecting(null); setDisconnectError(null) }}
                  disabled={disconnectLoading}
                  className="w-full py-2 text-xs transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
            <div className="space-y-4">
              {/* Credit Cards group */}
              {creditCards.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CreditCard size={12} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Credit Cards
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {creditCards.map(card => (
                      <AccountCustomizeRow
                        key={card.id}
                        account={card}
                        customization={customizations[card.id] || {}}
                        onChange={patch => handleChange(card.id, patch)}
                        people={people}
                        isDepository={false}
                        plaidInfo={card.plaidAccountId ? plaidAccountToItem.get(card.plaidAccountId) : undefined}
                        onDisconnect={handleInitiateDisconnect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Bank Accounts group */}
              {bankAccounts.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Landmark size={12} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Banking
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {bankAccounts.map(acct => (
                      <AccountCustomizeRow
                        key={acct.id}
                        account={acct}
                        customization={customizations[acct.id] || {}}
                        onChange={patch => handleChange(acct.id, patch)}
                        people={people}
                        isDepository={true}
                        plaidInfo={acct.plaidAccountId ? plaidAccountToItem.get(acct.plaidAccountId) : undefined}
                        onDisconnect={handleInitiateDisconnect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {creditCards.length === 0 && bankAccounts.length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No accounts to customize. Connect a bank or add credit cards first.
                </p>
              )}
            </div>
            )
          ) : (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Display settings coming soon. Use the Accounts tab to show/hide accounts and set friendly names.
              </p>
              <div className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-center justify-between py-1.5">
                  <span>Hidden accounts</span>
                  <span className="font-semibold">{hiddenCount}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span>Custom nicknames</span>
                  <span className="font-semibold">
                    {Object.values(customizations).filter(c => c.nickname).length}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span>Assigned accounts</span>
                  <span className="font-semibold">
                    {Object.values(customizations).filter(c => c.assignedTo != null).length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors"
            style={{
              background: 'var(--accent-blue)',
              color: '#fff',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
