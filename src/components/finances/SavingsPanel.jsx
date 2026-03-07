import { useState } from 'react'
import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import CurrencyInput from './CurrencyInput'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
      <path fillRule="evenodd" d="M8.914 6.025a.75.75 0 0 1 1.06 0 3.5 3.5 0 0 1 0 4.95l-2 2a3.5 3.5 0 0 1-4.95-4.95l1.25-1.25a.75.75 0 0 1 1.06 1.06l-1.25 1.25a2 2 0 1 0 2.83 2.83l2-2a2 2 0 0 0 0-2.83.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M7.086 9.975a.75.75 0 0 1-1.06 0 3.5 3.5 0 0 1 0-4.95l2-2a3.5 3.5 0 0 1 4.95 4.95l-1.25 1.25a.75.75 0 0 1-1.06-1.06l1.25-1.25a2 2 0 1 0-2.83-2.83l-2 2a2 2 0 0 0 0 2.83.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
    </svg>
  )
}

function formatSyncTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.round((now - d) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function lookupInstitution(plaidLinkedItems, plaidAccountId) {
  if (!plaidLinkedItems || !plaidAccountId) return null
  for (const item of plaidLinkedItems) {
    if (item.accounts?.some(a => a.id === plaidAccountId || a.account_id === plaidAccountId)) {
      return { name: item.institutionName, connectedBy: item.connectedBy }
    }
  }
  return null
}

export default function SavingsPanel({ accounts, onChange, people = [], filterPersonId = null, plaidLinkedItems = [] }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(accounts, onChange)
  const [expandedIds, setExpandedIds] = useState(new Set())

  const hasAnyPlaid = accounts.some(a => a.plaidAccountId)

  function toggleExpanded(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function updateAccount(id, field, val) {
    onChange(accounts.map(a => a.id === id ? { ...a, [field]: val } : a))
  }

  function toggleAccount(id) {
    onChange(accounts.map(a => a.id === id ? { ...a, active: a.active === false ? true : false } : a))
  }

  function deleteAccount(id) {
    onChange(accounts.filter(a => a.id !== id))
  }

  function addAccount() {
    onChange([...accounts, {
      id: Date.now(),
      name: 'New Account',
      amount: 0,
      active: true,
      assignedTo: null,
      description: '',
      balanceDate: new Date().toISOString().slice(0, 10),
    }])
  }

  const total = accounts
    .filter(a => a.active !== false)
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

  return (
    <div className="space-y-3">
      {/* Column headers — desktop only */}
      <div
        className="hidden sm:grid items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-semibold px-1"
        style={{ gridTemplateColumns: '20px 32px 1fr 130px 100px 32px 32px 32px' }}
      >
        <span></span>
        <span></span>
        <span>Account / Source</span>
        <span>Balance</span>
        <span>As of</span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      {/* Account rows */}
      <div className="space-y-2">
        {accounts.map(account => {
          const isActive = account.active !== false
          const dimmed = filterPersonId && !matchesPersonFilter(account.assignedTo, filterPersonId)
          const isPlaid = !!account.plaidAccountId
          const institution = isPlaid ? lookupInstitution(plaidLinkedItems, account.plaidAccountId) : null
          return (
            <div
              key={account.id}
              className={`row-savings-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                draggingId === account.id ? 'opacity-40' : ''
              } ${
                overedId === account.id && draggingId !== account.id
                  ? 'ring-2 ring-blue-500/50 ring-inset'
                  : ''
              } ${!isActive ? 'opacity-50' : ''} ${dimmed ? 'opacity-25' : ''}`}
              {...getItemProps(account.id)}
            >
              {/* Subrow 1: drag · toggle · name (+ Plaid badge) */}
              <div className="flex items-center gap-2 sm:contents">
                <div
                  className="text-gray-600 hover:text-gray-400 transition-colors flex items-center justify-center select-none flex-shrink-0"
                  {...dragHandleProps(account.id)}
                >
                  <DragHandle />
                </div>
                <button
                  type="button"
                  onClick={() => toggleAccount(account.id)}
                  title={isActive ? 'Exclude from total' : 'Include in total'}
                  className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer p-0.5 ${
                    isActive ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      isActive ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <input
                    type="text"
                    value={account.name}
                    onChange={e => updateAccount(account.id, 'name', e.target.value)}
                    className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Chase Checking"
                  />
                  {isPlaid && (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
                      style={{
                        background: 'color-mix(in srgb, var(--accent-emerald, #10b981) 12%, transparent)',
                        color: 'var(--accent-emerald, #10b981)',
                        border: '1px solid color-mix(in srgb, var(--accent-emerald, #10b981) 25%, transparent)',
                      }}
                      title={institution?.name ? `Synced from ${institution.name}` : 'Synced via Plaid'}
                    >
                      <LinkIcon />
                      {institution?.name || 'Synced'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(account.id)}
                    className="flex-shrink-0 p-0.5 transition-colors"
                    style={{ color: account.description ? 'var(--accent-blue, #3b82f6)' : 'var(--text-faint, #6b7280)' }}
                    title={expandedIds.has(account.id) ? 'Hide notes' : 'Show notes'}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4 transition-transform"
                      style={{ transform: expandedIds.has(account.id) ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Subrow 2: amount · date · assignee · comment · trash */}
              <div className="flex items-center gap-2 sm:contents">
                {isPlaid ? (
                  <div
                    className="flex-1 sm:flex-none flex items-center bg-gray-700/60 border border-gray-600/60 rounded-lg px-2 py-2"
                    title="Balance synced automatically via Plaid"
                  >
                    <span className="text-gray-500 text-sm mr-1">$</span>
                    <span className="text-white text-sm tabular-nums">
                      {(Number(account.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : (
                  <div className="flex-1 sm:flex-none flex items-center bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 focus-within:border-blue-500">
                    <span className="text-gray-500 text-sm mr-1">$</span>
                    <CurrencyInput
                      value={account.amount}
                      onChange={val => updateAccount(account.id, 'amount', val)}
                      className="bg-transparent text-white text-sm w-full outline-none"
                      min="0"
                    />
                  </div>
                )}
                {/* Date column: sync time for Plaid, date picker for manual */}
                {isPlaid ? (
                  <span
                    className="text-[11px] tabular-nums whitespace-nowrap w-[100px] text-center"
                    style={{ color: 'var(--text-muted, #9ca3af)' }}
                    title={account.plaidLastSync ? new Date(account.plaidLastSync).toLocaleString() : ''}
                  >
                    {formatSyncTime(account.plaidLastSync) || '—'}
                  </span>
                ) : (
                  <input
                    type="date"
                    value={account.balanceDate || ''}
                    onChange={e => updateAccount(account.id, 'balanceDate', e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-[100px]"
                    title="Date of this balance"
                  />
                )}
                <AssigneeSelect
                  people={people}
                  value={account.assignedTo ?? null}
                  onChange={val => updateAccount(account.id, 'assignedTo', val)}
                />
                <CommentButton itemId={`account_${account.id}`} label={account.name || 'Account'} />
                <button
                  onClick={() => deleteAccount(account.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center"
                  title="Remove account"
                >
                  <TrashIcon />
                </button>
              </div>
              {/* Description / notes + connected-by info (shown when expanded) */}
              {expandedIds.has(account.id) && (
                <div className="sm:col-span-8">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={account.description || ''}
                      onChange={e => updateAccount(account.id, 'description', e.target.value)}
                      className="flex-1 bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-blue-500 placeholder-gray-600"
                      placeholder="Add a note..."
                    />
                    {isPlaid && institution?.connectedBy && (
                      <span className="text-[10px] whitespace-nowrap flex-shrink-0" style={{ color: 'var(--text-faint, #6b7280)' }}>
                        connected by {institution.connectedBy}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={addAccount}
        className="w-full py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-blue-500 hover:text-blue-400 text-sm transition-colors"
      >
        + Add Account
      </button>

      <div className="bg-gray-700/40 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">Total Cash Available</span>
        <span className="text-white text-2xl font-bold sensitive">{formatCurrency(total)}</span>
      </div>

      {hasAnyPlaid && (
        <p className="text-xs" style={{ color: 'var(--text-faint, #6b7280)' }}>
          Some balances sync automatically via <strong>Plaid</strong>. Synced accounts update when you click Sync in the Connected Bank Accounts section.
        </p>
      )}
    </div>
  )
}
