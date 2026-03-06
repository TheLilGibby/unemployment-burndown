import { useState, useMemo, useEffect } from 'react'
import { Landmark, CreditCard, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
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

export default function StatementList({ statementIndex, creditCards, savingsAccounts = [], people = [], selectedCardId, onLoadStatement, user, accountCustomizations = {} }) {
  const [expandedAccounts, setExpandedAccounts] = useState({})

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

  // Auto-expand when a single account is selected
  useEffect(() => {
    if (selectedCardId !== null) {
      setExpandedAccounts({ [selectedCardId]: true })
    } else {
      setExpandedAccounts({})
    }
  }, [selectedCardId])

  // Group statements by account and compute summaries
  const { accountGroups, pulse } = useMemo(() => {
    const byCard = new Map()
    for (const stmt of stmts) {
      if (!byCard.has(stmt.cardId)) byCard.set(stmt.cardId, [])
      byCard.get(stmt.cardId).push(stmt)
    }

    const groups = []
    let totalCredit = 0
    let totalSavings = 0
    let latestDate = null

    for (const [cardId, cardStmts] of byCard) {
      const latest = cardStmts[0]
      const previous = cardStmts.length > 1 ? cardStmts[1] : null
      const latestBal = Math.abs(latest.statementBalance || 0)
      const previousBal = previous ? Math.abs(previous.statementBalance || 0) : null
      const balanceChange = previousBal !== null ? latestBal - previousBal : null
      const isDepository = latest.accountType === 'depository'
      const isPlaid = latest.source === 'plaid'
      const card = getCard(cardId)
      const person = getPerson(cardId)
      const totalTxns = cardStmts.reduce((sum, s) => sum + (s.transactionCount || 0), 0)

      if (isDepository) {
        totalSavings += latestBal
      } else {
        totalCredit += latestBal
      }

      if (!latestDate || (latest.closingDate && latest.closingDate > latestDate)) {
        latestDate = latest.closingDate
      }

      const nickname = accountCustomizations[cardId]?.nickname
      groups.push({
        cardId,
        accountName: nickname || (isPlaid && latest.accountName ? latest.accountName : getCardName(cardId)),
        last4: card?.last4 || latest.cardLastFour || null,
        issuer: latest.issuer,
        isPlaid,
        isDepository,
        person,
        latestBalance: latestBal,
        balanceChange,
        statementCount: cardStmts.length,
        totalTransactions: totalTxns,
        latestDate: latest.closingDate,
        statements: cardStmts,
      })
    }

    // Sort groups: credit cards first, then depository, each sorted by latest balance desc
    groups.sort((a, b) => {
      if (a.isDepository !== b.isDepository) return a.isDepository ? 1 : -1
      return b.latestBalance - a.latestBalance
    })

    const latestMonth = latestDate
      ? new Date(latestDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null

    return {
      accountGroups: groups,
      pulse: {
        totalCredit,
        totalSavings,
        accountCount: groups.length,
        totalStatements: stmts.length,
        latestMonth,
        hasDepository: groups.some(g => g.isDepository),
      },
    }
  }, [stmts]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAccount = (cardId) =>
    setExpandedAccounts(prev => ({ ...prev, [cardId]: !prev[cardId] }))

  if (stmts.length === 0) {
    return (
      <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        No statements found. Connect a bank or forward credit card statement emails to start importing.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Pulse bar — key metrics at a glance */}
      <div
        className="rounded-lg px-4 py-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
      >
        {pulse.totalCredit > 0 && (
          <div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Credit balances </span>
            <span className="font-semibold tabular-nums" style={{ color: '#f87171' }}>
              {formatCurrency(pulse.totalCredit)}
            </span>
          </div>
        )}
        {pulse.hasDepository && (
          <div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Savings </span>
            <span className="font-semibold tabular-nums" style={{ color: '#34d399' }}>
              {formatCurrency(pulse.totalSavings)}
            </span>
          </div>
        )}
        <div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Accounts </span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {pulse.accountCount}
          </span>
        </div>
        <div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Statements </span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            {pulse.totalStatements}
          </span>
        </div>
        {pulse.latestMonth && (
          <div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Latest </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {pulse.latestMonth}
            </span>
          </div>
        )}
      </div>

      {/* Account groups */}
      <div className="space-y-1.5">
        {accountGroups.map(group => {
          const isExpanded = !!expandedAccounts[group.cardId]

          return (
            <div key={group.cardId}>
              {/* Account group header */}
              <button
                onClick={() => toggleAccount(group.cardId)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: isExpanded ? 'var(--accent-blue)' : 'var(--border-input)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.borderColor = 'var(--border-input)' }}
              >
                <ChevronRight
                  size={14}
                  strokeWidth={2}
                  className="flex-shrink-0 transition-transform duration-200"
                  style={{
                    color: 'var(--text-muted)',
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                />

                {group.isDepository ? (
                  <Landmark size={18} strokeWidth={1.75} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <CreditCard size={18} strokeWidth={1.75} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                )}

                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {group.accountName}
                    {group.last4 && (
                      <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        ••••{group.last4}
                      </span>
                    )}
                    {group.issuer && (
                      <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        ({group.issuer})
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
                  {/* Trend indicator */}
                  {group.balanceChange !== null && group.balanceChange !== 0 && (
                    <span className="flex items-center gap-1 text-xs font-medium">
                      {group.isDepository ? (
                        // For savings: balance going up = good (green), down = bad (red)
                        group.balanceChange > 0 ? (
                          <>
                            <TrendingUp size={13} style={{ color: '#34d399' }} />
                            <span style={{ color: '#34d399' }}>+{formatCurrency(group.balanceChange)}</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown size={13} style={{ color: '#f87171' }} />
                            <span style={{ color: '#f87171' }}>{formatCurrency(group.balanceChange)}</span>
                          </>
                        )
                      ) : (
                        // For credit: balance going down = good (green), up = bad (red)
                        group.balanceChange < 0 ? (
                          <>
                            <TrendingDown size={13} style={{ color: '#34d399' }} />
                            <span style={{ color: '#34d399' }}>{formatCurrency(group.balanceChange)}</span>
                          </>
                        ) : (
                          <>
                            <TrendingUp size={13} style={{ color: '#f87171' }} />
                            <span style={{ color: '#f87171' }}>+{formatCurrency(group.balanceChange)}</span>
                          </>
                        )
                      )}
                    </span>
                  )}

                  {/* Latest balance */}
                  <span className="text-sm font-semibold tabular-nums" style={{
                    color: group.isDepository ? 'var(--text-primary)' : '#f87171'
                  }}>
                    {formatCurrency(group.latestBalance)}
                  </span>

                  {/* Statement count pill */}
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {group.statementCount} stmt{group.statementCount !== 1 ? 's' : ''}
                  </span>

                  {/* Household member / user icon */}
                  {group.person ? (
                    <PersonAvatar person={group.person} />
                  ) : (
                    <UserBadge user={user} />
                  )}
                </div>
              </button>

              {/* Expanded: individual statement rows */}
              {isExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {group.statements.map(stmt => {
                    const isPlaid = stmt.source === 'plaid'
                    return (
                      <button
                        key={stmt.id}
                        onClick={() => onLoadStatement(stmt.id)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all"
                        style={{
                          background: 'var(--bg-card)',
                          borderColor: 'var(--border-subtle)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
                      >
                        <div className="text-left min-w-0">
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {stmt.closingDate
                              ? isPlaid
                                ? new Date(stmt.closingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                : new Date(stmt.closingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'No date'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {stmt.transactionCount != null && (
                              <span>{stmt.transactionCount} transactions</span>
                            )}
                            {stmt.parsedAt && (
                              <span>
                                {stmt.transactionCount != null ? ' · ' : ''}
                                {isPlaid ? 'Synced' : 'Imported'} {new Date(stmt.parsedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums flex-shrink-0 ml-3" style={{
                          color: group.isDepository ? 'var(--text-primary)' : '#f87171'
                        }}>
                          {formatCurrency(Math.abs(stmt.statementBalance || 0))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
