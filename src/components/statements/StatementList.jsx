import { Landmark } from 'lucide-react'
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

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function PersonAvatar({ person }) {
  const bg = COLOR_MAP[person.color] ?? '#6b7280'
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ background: bg }}
      title={person.name}
    >
      {getInitials(person.name)}
    </div>
  )
}

function UserBadge({ user }) {
  const color = PROFILE_COLORS[user?.profileColor] || PROFILE_COLORS.blue
  const initials = user?.email ? user.email[0].toUpperCase() : '?'
  const avatar = user?.avatarDataUrl
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden"
      style={{ border: `2px solid ${color}`, background: avatar ? 'none' : color + '22', color }}
      title="Your account"
    >
      {avatar
        ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </div>
  )
}

export default function StatementList({ statementIndex, creditCards, savingsAccounts = [], people = [], selectedCardId, onLoadStatement, user }) {
  const stmts = (statementIndex?.statements || [])
    .filter(s => selectedCardId === null || s.cardId === selectedCardId)
    .sort((a, b) => (b.closingDate || '').localeCompare(a.closingDate || ''))

  const getCard = (cardId) =>
    creditCards.find(c => c.id === cardId) || savingsAccounts.find(a => a.id === cardId)
  const getCardName = (cardId) => getCard(cardId)?.name || 'Unknown Account'
  const getPerson = (cardId) => {
    const card = creditCards.find(c => c.id === cardId)
    if (!card?.assignedTo) return null
    return people.find(p => p.id === card.assignedTo) ?? null
  }

  if (stmts.length === 0) {
    return (
      <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        No statements found. Connect a bank or forward credit card statement emails to start importing.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {stmts.map(stmt => {
        const isPlaid = stmt.source === 'plaid'
        const person = getPerson(stmt.cardId)

        return (
          <button
            key={stmt.id}
            onClick={() => onLoadStatement(stmt.id)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-input)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent-blue)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-input)'
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {person ? (
                <PersonAvatar person={person} />
              ) : isPlaid && stmt.accountType === 'depository' ? (
                <Landmark size={18} strokeWidth={1.75} style={{ color: 'var(--text-muted)' }} />
              ) : (
                <UserBadge user={user} />
              )}
              <div className="text-left min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {isPlaid && stmt.accountName ? stmt.accountName : getCardName(stmt.cardId)}
                  {getCard(stmt.cardId)?.last4 && (
                    <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      ••••{getCard(stmt.cardId).last4}
                    </span>
                  )}
                  {stmt.issuer && (
                    <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      ({stmt.issuer})
                    </span>
                  )}
                  {isPlaid && (
                    <span
                      className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)' }}
                    >
                      Bank Sync
                    </span>
                  )}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {stmt.closingDate
                    ? isPlaid
                      ? new Date(stmt.closingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                      : new Date(stmt.closingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No date'}
                  {stmt.transactionCount != null && (
                    <span> &middot; {stmt.transactionCount} transactions</span>
                  )}
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-sm font-semibold tabular-nums" style={{
                color: isPlaid && stmt.accountType === 'depository'
                  ? 'var(--text-primary)'
                  : '#f87171'
              }}>
                {formatCurrency(Math.abs(stmt.statementBalance || 0))}
              </p>
              {stmt.parsedAt && (
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  {isPlaid ? 'Synced' : 'Imported'} {new Date(stmt.parsedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
