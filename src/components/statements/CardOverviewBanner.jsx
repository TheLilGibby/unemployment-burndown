import { CreditCard, Landmark } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

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

export default function CardOverviewBanner({ creditCards, savingsAccounts = [], statementIndex, selectedCardId, onSelectCard, people = [] }) {
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
    return { ...acct, statementCount: stmts.length, person: null }
  })

  const allPills = [...cards, ...banks]
  const totalStmts = (statementIndex?.statements || []).length

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

          return (
            <button
              key={item.id}
              onClick={() => onSelectCard(item.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
              style={{
                borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-input)',
                background: isSelected ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))' : 'var(--bg-input)',
                color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}
            >
              {item.person ? (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: personBg }}
                  title={item.person.name}
                >
                  {getInitials(item.person.name)}
                </div>
              ) : item.isDepository ? (
                <Landmark size={16} strokeWidth={1.75} style={{ color: 'var(--accent-emerald)' }} />
              ) : (
                <CreditCard size={16} strokeWidth={1.75} />
              )}
              <div className="text-left">
                <div>
                  {item.name}
                  {item.last4 && (
                    <span className="ml-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      ••••{item.last4}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: item.isDepository ? 'var(--accent-emerald)' : undefined }}>
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
              </div>
            </button>
          )
        })}
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
              <span className="font-semibold" style={{ color: 'var(--accent-emerald)' }}>
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
