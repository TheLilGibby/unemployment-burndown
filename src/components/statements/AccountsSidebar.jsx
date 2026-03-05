import { useState, useMemo } from 'react'
import { CreditCard, Landmark, Settings, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import PlaidLinkButton from '../plaid/PlaidLinkButton'
import AccountCustomizeModal from './AccountCustomizeModal'

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

function ChevronIcon({ open }) {
  return open ? <ChevronDown size={12} /> : <ChevronRight size={12} />
}

function PersonBadge({ person }) {
  if (!person) return null
  const bgClass = COLOR_CLASSES[person.color] ?? 'bg-gray-500'
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white shrink-0 ${bgClass}`}
      title={person.name}
    >
      {getInitials(person.name)}
    </span>
  )
}

function AccountRow({ item, isSelected, onSelect, isDepository, customization, person }) {
  const utilPct = !isDepository && item.creditLimit > 0
    ? Math.round((item.balance / item.creditLimit) * 100)
    : null

  const displayName = customization?.nickname || item.name

  return (
    <button
      onClick={() => onSelect(item.id)}
      className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all rounded-lg"
      style={{
        background: isSelected ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--accent-blue)' : '2px solid transparent',
      }}
    >
      {/* Person badge */}
      <PersonBadge person={person} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs truncate" style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
            {displayName}
          </span>
          {item.last4 && (
            <span className="text-[10px] shrink-0" style={{ color: 'var(--text-faint)' }}>
              ••{item.last4}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isDepository && item.subtype && (
            <span
              className="px-1 py-0 rounded text-[9px] font-semibold uppercase tracking-wide"
              style={{
                background: 'color-mix(in srgb, var(--accent-emerald) 15%, transparent)',
                color: 'var(--accent-emerald)',
              }}
            >
              {item.subtype}
            </span>
          )}
          {utilPct !== null && (
            <span className="text-[10px] font-medium" style={{
              color: utilPct >= 90 ? '#f87171' : utilPct >= 60 ? '#fb923c' : utilPct >= 30 ? '#facc15' : '#34d399'
            }}>
              {utilPct}%
            </span>
          )}
          {item.statementCount > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
              {item.statementCount} stmt{item.statementCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <span
        className="text-xs font-semibold tabular-nums shrink-0"
        style={{ color: isDepository ? 'var(--accent-emerald)' : 'var(--text-primary)' }}
      >
        {formatCurrency(Math.abs(item.balance || 0))}
      </span>
    </button>
  )
}

function AccountGroup({ label, icon: Icon, iconColor, items, subtotal, subtotalColor, selectedCardId, onSelectCard, isDepository, customizations, people }) {
  const [open, setOpen] = useState(true)

  if (items.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <Icon size={13} strokeWidth={1.75} style={{ color: iconColor }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-semibold tabular-nums" style={{ color: subtotalColor }}>
            {formatCurrency(subtotal)}
          </span>
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <div className="space-y-0.5">
          {items.map(item => {
            const cust = customizations?.[item.id]
            const person = cust?.assignedTo ? people.find(p => p.id === cust.assignedTo) : null
            return (
              <AccountRow
                key={item.id}
                item={item}
                isSelected={selectedCardId === item.id}
                onSelect={onSelectCard}
                isDepository={isDepository}
                customization={cust}
                person={person}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AccountsSidebar({
  creditCards, savingsAccounts = [], statementIndex, selectedCardId, onSelectCard,
  plaid, onSync, people = [], user,
  onCreditCardsChange, onSavingsChange, onStatementsRefresh,
  loading, error,
  accountCustomizations = {}, onAccountCustomizationsChange,
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false)

  // Build bank accounts list (same logic as CreditCardHubPage)
  const plaidBankAccountIds = useMemo(() => new Set(
    (statementIndex?.statements || [])
      .filter(s => s.source === 'plaid' && s.accountType === 'depository')
      .map(s => s.plaidAccountId)
  ), [statementIndex])

  const bankAccounts = useMemo(() => savingsAccounts
    .filter(sa => sa.plaidAccountId && plaidBankAccountIds.has(sa.plaidAccountId))
    .map(sa => {
      const stmts = (statementIndex?.statements || []).filter(s => s.cardId === sa.id)
      let subtype = sa.plaidSubtype || null
      if (!subtype && sa.plaidAccountId) {
        const stmtEntry = (statementIndex?.statements || []).find(s => s.plaidAccountId === sa.plaidAccountId)
        if (stmtEntry?.accountSubtype) subtype = stmtEntry.accountSubtype
      }
      if (!subtype) {
        const m = sa.name?.match(/\((checking|savings|cd|money market)\)/i)
        if (m) subtype = m[1].toLowerCase()
      }
      return {
        ...sa,
        balance: sa.amount,
        isDepository: true,
        statementCount: stmts.length,
        subtype,
      }
    }), [savingsAccounts, plaidBankAccountIds, statementIndex])

  const allCards = useMemo(() => creditCards.map(card => {
    const stmts = (statementIndex?.statements || []).filter(s => s.cardId === card.id)
    return { ...card, statementCount: stmts.length, isDepository: false }
  }), [creditCards, statementIndex])

  // Filter hidden accounts for display
  const cards = useMemo(() =>
    allCards.filter(c => !accountCustomizations[c.id]?.hidden),
    [allCards, accountCustomizations]
  )
  const visibleBankAccounts = useMemo(() =>
    bankAccounts.filter(a => !accountCustomizations[a.id]?.hidden),
    [bankAccounts, accountCustomizations]
  )

  const totalBalance = useMemo(() => {
    const bankTotal = visibleBankAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0)
    const creditTotal = cards.reduce((s, c) => s + (Number(c.balance) || 0), 0)
    return bankTotal + creditTotal
  }, [visibleBankAccounts, cards])

  const creditSubtotal = cards.reduce((s, c) => s + (Number(c.balance) || 0), 0)
  const bankSubtotal = visibleBankAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0)

  const lastSync = plaid?.lastSync
    ? new Date(plaid.lastSync).toLocaleDateString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : statementIndex?.lastUpdated
      ? new Date(statementIndex.lastUpdated).toLocaleDateString('en-US', {
          month: 'short', day: '2-digit', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        })
      : null

  const stmtCount = statementIndex?.statements?.length || 0
  const allAccountCount = cards.length + visibleBankAccounts.length
  const hiddenCount = Object.values(accountCustomizations).filter(c => c.hidden).length

  // ---- Desktop sidebar ----
  const desktopSidebar = (
    <aside
      className="hidden xl:flex flex-col fixed z-40 rounded-xl"
      style={{
        top: '5.5rem',
        left: '0.75rem',
        width: '16rem',
        maxHeight: 'calc(100vh - 7rem)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
      }}
      aria-label="Accounts sidebar"
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Accounts
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCustomizeOpen(true)}
              className="p-1 rounded transition-colors"
              style={{ color: customizeOpen ? 'var(--accent-blue)' : 'var(--text-muted)' }}
              title="Customize accounts"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
        {lastSync && (
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
            As of {lastSync}
          </p>
        )}
      </div>

      {/* All accounts row */}
      <button
        onClick={() => onSelectCard(null)}
        className="w-full flex items-center justify-between px-3 py-2.5 transition-all"
        style={{
          borderTop: '1px solid var(--border-default)',
          borderBottom: '1px solid var(--border-default)',
          background: selectedCardId === null ? 'color-mix(in srgb, var(--accent-blue) 8%, var(--bg-card))' : 'transparent',
        }}
      >
        <span className="text-xs font-semibold" style={{ color: selectedCardId === null ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
          All accounts
        </span>
        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {formatCurrency(totalBalance)}
        </span>
      </button>

      {/* Scrollable account groups */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
        <AccountGroup
          label="Credit Cards"
          icon={CreditCard}
          iconColor="var(--text-muted)"
          items={cards}
          subtotal={creditSubtotal}
          subtotalColor="#f87171"
          selectedCardId={selectedCardId}
          onSelectCard={onSelectCard}
          isDepository={false}
          customizations={accountCustomizations}
          people={people}
        />

        {cards.length > 0 && visibleBankAccounts.length > 0 && (
          <div className="my-1 mx-3" style={{ borderTop: '1px solid var(--border-subtle)' }} />
        )}

        <AccountGroup
          label="Banking"
          icon={Landmark}
          iconColor="var(--accent-emerald)"
          items={visibleBankAccounts}
          subtotal={bankSubtotal}
          subtotalColor="var(--accent-emerald)"
          selectedCardId={selectedCardId}
          onSelectCard={onSelectCard}
          isDepository={true}
          customizations={accountCustomizations}
          people={people}
        />
      </div>

      {/* Footer: status + controls */}
      <div className="shrink-0 px-3 py-2" style={{ borderTop: '1px solid var(--border-default)' }}>
        {/* Connection status */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: error ? '#f87171' : loading ? '#facc15' : '#34d399',
            }}
          />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {error ? 'Connection error' : loading ? 'Loading...' : `${stmtCount} statements`}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            {allAccountCount} acct{allAccountCount !== 1 ? 's' : ''}
            {hiddenCount > 0 && ` · ${hiddenCount} hidden`}
          </span>
        </div>

        {/* Action buttons */}
        {plaid && (
          <div className="flex items-center gap-2">
            <PlaidLinkButton
              createLinkToken={plaid.createLinkToken}
              exchangeToken={plaid.exchangeToken}
              syncAll={onSync}
              linkedCount={plaid.linkedItems.length}
              syncing={plaid.syncing}
            />
            {plaid.linkedItems.length > 0 && (
              <button
                onClick={() => onSync()}
                disabled={plaid.syncing}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors"
                style={{
                  borderColor: plaid.syncing ? 'var(--border-subtle)' : 'var(--accent-blue)',
                  color: plaid.syncing ? 'var(--text-muted)' : 'var(--accent-blue)',
                  background: plaid.syncing ? 'transparent' : 'rgba(59, 130, 246, 0.08)',
                  cursor: plaid.syncing ? 'wait' : 'pointer',
                }}
              >
                <RefreshCw size={10} className={plaid.syncing ? 'animate-spin' : ''} />
                {plaid.syncing ? 'Syncing' : 'Sync'}
              </button>
            )}
          </div>
        )}
        {plaid?.error && (
          <p className="text-[10px] mt-1" style={{ color: '#f87171' }}>{plaid.error}</p>
        )}
      </div>
    </aside>
  )

  // ---- Mobile compact pills (< xl) ----
  const mobileBanner = (
    <div className="xl:hidden space-y-3">
      {/* Connection status bar */}
      <div
        className="rounded-lg border px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: error ? '#f87171' : loading ? '#facc15' : '#34d399' }}
          />
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            {error ? 'Error' : loading ? 'Loading' : `${allAccountCount} accounts`}
          </span>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
          {stmtCount} stmt{stmtCount !== 1 ? 's' : ''}
        </span>
        {/* Settings gear for mobile */}
        <button
          onClick={() => setCustomizeOpen(true)}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Customize accounts"
        >
          <Settings size={12} />
        </button>
        {plaid && (
          <div className="flex items-center gap-2 ml-auto">
            <PlaidLinkButton
              createLinkToken={plaid.createLinkToken}
              exchangeToken={plaid.exchangeToken}
              syncAll={onSync}
              linkedCount={plaid.linkedItems.length}
              syncing={plaid.syncing}
            />
            {plaid.linkedItems.length > 0 && (
              <button
                onClick={() => onSync()}
                disabled={plaid.syncing}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors"
                style={{
                  borderColor: plaid.syncing ? 'var(--border-subtle)' : 'var(--accent-blue)',
                  color: plaid.syncing ? 'var(--text-muted)' : 'var(--accent-blue)',
                  background: plaid.syncing ? 'transparent' : 'rgba(59, 130, 246, 0.08)',
                  cursor: plaid.syncing ? 'wait' : 'pointer',
                }}
              >
                <RefreshCw size={10} className={plaid.syncing ? 'animate-spin' : ''} />
                {plaid.syncing ? 'Syncing' : 'Sync'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compact account pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onSelectCard(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
          style={{
            borderColor: selectedCardId === null ? 'var(--accent-blue)' : 'var(--border-input)',
            background: selectedCardId === null ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))' : 'var(--bg-input)',
            color: selectedCardId === null ? 'var(--accent-blue)' : 'var(--text-secondary)',
          }}
        >
          <CreditCard size={12} />
          All
        </button>

        {cards.map(item => {
          const isSelected = selectedCardId === item.id
          const cust = accountCustomizations[item.id]
          const person = cust?.assignedTo ? people.find(p => p.id === cust.assignedTo) : null
          const displayName = cust?.nickname || item.name
          return (
            <button
              key={item.id}
              onClick={() => onSelectCard(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={{
                borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-input)',
                background: isSelected ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))' : 'var(--bg-input)',
                color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}
            >
              {person && <PersonBadge person={person} />}
              <CreditCard size={12} />
              <span className="truncate max-w-[120px]">{displayName}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatCurrency(item.balance || 0)}</span>
            </button>
          )
        })}

        {visibleBankAccounts.map(item => {
          const isSelected = selectedCardId === item.id
          const cust = accountCustomizations[item.id]
          const person = cust?.assignedTo ? people.find(p => p.id === cust.assignedTo) : null
          const displayName = cust?.nickname || item.name
          return (
            <button
              key={item.id}
              onClick={() => onSelectCard(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
              style={{
                borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-input)',
                background: isSelected ? 'color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))' : 'var(--bg-input)',
                color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}
            >
              {person && <PersonBadge person={person} />}
              <Landmark size={12} style={{ color: 'var(--accent-emerald)' }} />
              <span className="truncate max-w-[120px]">{displayName}</span>
              <span className="text-[10px]" style={{ color: 'var(--accent-emerald)' }}>{formatCurrency(item.balance || 0)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
      {desktopSidebar}
      {mobileBanner}

      {/* Customize modal */}
      <AccountCustomizeModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        creditCards={allCards}
        bankAccounts={bankAccounts}
        customizations={accountCustomizations}
        onCustomizationsChange={onAccountCustomizationsChange}
        people={people}
      />
    </>
  )
}
