import { useState, useRef, useEffect } from 'react'
import { CreditCard, Landmark, Settings, X, Pencil, Check } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { PROFILE_COLORS } from '../profile/ProfileBubble'

const COLOR_MAP = {
  blue:    '#3b82f6',
  purple:  '#a855f7',
  emerald: '#10b981',
  amber:   '#fbbf24',
  rose:    '#f43f5e',
  cyan:    '#06b6d4',
}

function UserBadge({ user }) {
  const color = PROFILE_COLORS[user?.profileColor] || PROFILE_COLORS.blue
  const initials = user?.email ? user.email[0].toUpperCase() : '?'
  const avatar = user?.avatarDataUrl
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 overflow-hidden"
      style={{ border: `2px solid ${color}`, background: avatar ? 'none' : color + '22', color }}
      title="Your account"
    >
      {avatar
        ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  )
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const API_BASE = import.meta.env.VITE_PLAID_API_URL || ''
const TOKEN_KEY = 'burndown_token'
function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function CardOverviewBanner({
  creditCards, savingsAccounts = [], statementIndex, selectedCardId, onSelectCard, people = [],
  onCreditCardsChange, onSavingsChange, onStatementsRefresh, user, accountCustomizations = {},
}) {
  const [managing, setManaging] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const editInputRef = useRef(null)

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus()
  }, [editingId])

  // Build unified list: credit cards + Plaid bank accounts that have statements
  const plaidBankAccountIds = new Set(
    (statementIndex?.statements || [])
      .filter(s => s.source === 'plaid' && s.accountType === 'depository')
      .map(s => s.plaidAccountId)
  )

  const bankAccounts = savingsAccounts
    .filter(sa => sa.plaidAccountId && plaidBankAccountIds.has(sa.plaidAccountId))
    .map(sa => ({
      ...sa,
      balance: sa.amount,
      isDepository: true,
    }))

  const cards = creditCards.map(card => {
    const stmts = (statementIndex?.statements || []).filter(s => s.cardId === card.id)
    const latestStmt = stmts.sort((a, b) => b.closingDate?.localeCompare(a.closingDate))[0]
    const person = card.assignedTo ? (people.find(p => p.id === card.assignedTo) ?? null) : null
    return { ...card, statementCount: stmts.length, latestStmt, person, isDepository: false }
  })

  const banks = bankAccounts.map(acct => {
    const stmts = (statementIndex?.statements || []).filter(s => s.cardId === acct.id)
    // Derive subtype: prefer explicit field, then match from statement index, then parse from name
    let subtype = acct.plaidSubtype || null
    if (!subtype && acct.plaidAccountId) {
      const stmtEntry = (statementIndex?.statements || []).find(s => s.plaidAccountId === acct.plaidAccountId)
      if (stmtEntry?.accountSubtype) subtype = stmtEntry.accountSubtype
    }
    if (!subtype) {
      const m = acct.name?.match(/\((checking|savings|cd|money market)\)/i)
      if (m) subtype = m[1].toLowerCase()
    }
    return { ...acct, statementCount: stmts.length, person: null, subtype }
  })

  const allPills = [...cards, ...banks]
  const totalStmts = (statementIndex?.statements || []).length

  function startRename(item) {
    setEditingId(item.id)
    setEditName(item.name)
    setConfirmDeleteId(null)
  }

  function commitRename(item) {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === item.name) {
      setEditingId(null)
      return
    }
    if (item.isDepository) {
      onSavingsChange?.(savingsAccounts.map(a => a.id === item.id ? { ...a, name: trimmed } : a))
    } else {
      onCreditCardsChange?.(creditCards.map(c => c.id === item.id ? { ...c, name: trimmed } : c))
    }
    setEditingId(null)
  }

  async function deleteAccountStatements(cardId) {
    try {
      await fetch(`${API_BASE}/api/statements/by-account/${cardId}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      })
      onStatementsRefresh?.()
    } catch { /* best effort */ }
  }

  function handleDelete(item) {
    if (confirmDeleteId === item.id) {
      // Second click — confirmed
      if (item.isDepository) {
        onSavingsChange?.(savingsAccounts.filter(a => a.id !== item.id))
      } else {
        onCreditCardsChange?.(creditCards.filter(c => c.id !== item.id))
      }
      deleteAccountStatements(item.id)
      if (selectedCardId === item.id) onSelectCard(null)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(item.id)
      setEditingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Account pills */}
      <div className="flex flex-wrap gap-2">
        {/* "All" pill */}
        <button
          onClick={() => onSelectCard(null)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
          style={{
            borderColor: selectedCardId === null ? 'var(--accent-blue)' : 'var(--border-input)',
            background: selectedCardId === null ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))' : 'var(--bg-input)',
            color: selectedCardId === null ? 'var(--accent-blue)' : 'var(--text-secondary)',
          }}
        >
          <CreditCard size={16} strokeWidth={1.75} />
          <span>All Accounts</span>
        </button>

        {allPills.map(item => {
          const isSelected = selectedCardId === item.id
          const utilPct = !item.isDepository && item.creditLimit > 0
            ? Math.round((item.balance / item.creditLimit) * 100)
            : null
          const personBg = item.person ? (COLOR_MAP[item.person.color] ?? '#6b7280') : null
          const isEditing = editingId === item.id
          const isConfirmingDelete = confirmDeleteId === item.id

          return (
            <div key={item.id} className="relative flex items-stretch">
              <button
                onClick={() => { if (!managing) onSelectCard(item.id) }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
                style={{
                  borderColor: isConfirmingDelete ? '#f87171' : isSelected ? 'var(--accent-blue)' : 'var(--border-input)',
                  background: isConfirmingDelete
                    ? 'rgba(248, 113, 113, 0.08)'
                    : isSelected ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))' : 'var(--bg-input)',
                  color: isConfirmingDelete ? '#f87171' : isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  borderTopRightRadius: managing ? 0 : undefined,
                  borderBottomRightRadius: managing ? 0 : undefined,
                }}
              >
                {/* Type icon — always on the left */}
                {item.isDepository ? (
                  <Landmark size={16} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <CreditCard size={16} strokeWidth={1.75} />
                )}
                <div className="text-left">
                  {isEditing ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={e => { e.preventDefault(); commitRename(item) }}
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={() => commitRename(item)}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                        className="bg-transparent outline-none text-sm font-medium w-full min-w-[80px]"
                        style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--accent-blue)' }}
                        onClick={e => e.stopPropagation()}
                      />
                      <button
                        type="submit"
                        className="flex-shrink-0"
                        onClick={e => e.stopPropagation()}
                        style={{ color: 'var(--accent-blue)' }}
                      >
                        <Check size={14} />
                      </button>
                    </form>
                  ) : (
                    <div>
                      {accountCustomizations[item.id]?.nickname || item.name}
                      {item.last4 && (
                        <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          ••••{item.last4}
                        </span>
                      )}
                    </div>
                  )}
                  {!isEditing && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.isDepository && item.subtype && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {item.subtype}
                        </span>
                      )}
                      <span style={{ color: item.isDepository ? 'var(--text-primary)' : undefined }}>
                        {formatCurrency(item.balance || 0)}
                      </span>
                      {utilPct !== null && (
                        <span style={{
                          color: utilPct >= 90 ? '#f87171' : utilPct >= 60 ? '#fb923c' : utilPct >= 30 ? '#facc15' : '#34d399'
                        }}>
                          {utilPct}%
                        </span>
                      )}
                      {item.statementCount > 0 && (
                        <span>{item.statementCount} stmt{item.statementCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  )}
                </div>
                {/* Person / user badge — on the right */}
                {item.person ? (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: personBg }}
                    title={item.person.name}
                  >
                    {getInitials(item.person.name)}
                  </div>
                ) : (
                  <UserBadge user={user} />
                )}
              </button>

              {/* Manage controls — rename & delete */}
              {managing && (
                <div
                  className="flex items-center gap-0.5 px-1.5 border border-l-0 rounded-r-xl transition-all"
                  style={{
                    borderColor: isConfirmingDelete ? '#f87171' : 'var(--border-input)',
                    background: isConfirmingDelete ? 'rgba(248,113,113,0.08)' : 'var(--bg-input)',
                  }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); startRename(item) }}
                    className="p-1 rounded transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="Rename account"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(item) }}
                    className="p-1 rounded transition-colors"
                    style={{ color: isConfirmingDelete ? '#f87171' : 'var(--text-muted)' }}
                    onMouseEnter={e => { if (confirmDeleteId !== item.id) e.currentTarget.style.color = '#f87171' }}
                    onMouseLeave={e => { if (confirmDeleteId !== item.id) e.currentTarget.style.color = 'var(--text-muted)' }}
                    title={isConfirmingDelete ? 'Click again to confirm removal' : 'Remove account'}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Manage toggle */}
        {(onCreditCardsChange || onSavingsChange) && allPills.length > 0 && (
          <button
            onClick={() => {
              setManaging(m => !m)
              setConfirmDeleteId(null)
              setEditingId(null)
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all"
            style={{
              borderColor: managing ? 'var(--accent-blue)' : 'var(--border-subtle)',
              background: managing ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))' : 'transparent',
              color: managing ? 'var(--accent-blue)' : 'var(--text-muted)',
            }}
            title="Manage accounts"
          >
            <Settings size={14} />
            {managing ? 'Done' : 'Manage'}
          </button>
        )}
      </div>

      {/* Summary stats row */}
      {(creditCards.length > 0 || bankAccounts.length > 0) && (
        <div
          className="rounded-lg px-4 py-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        >
          {creditCards.length > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Credit balance: </span>
              <span className="font-semibold" style={{ color: '#f87171' }}>
                {formatCurrency(creditCards.reduce((s, c) => s + (Number(c.balance) || 0), 0))}
              </span>
            </div>
          )}
          {bankAccounts.length > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Bank balance: </span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(bankAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0))}
              </span>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Accounts: </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {allPills.length}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Statements: </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {totalStmts}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
