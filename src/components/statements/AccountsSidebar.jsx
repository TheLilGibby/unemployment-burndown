import { useState, useMemo, useEffect, useCallback } from 'react'
import usePersistedState from '../../hooks/usePersistedState'
import { CreditCard, Landmark, Settings, ChevronDown, ChevronRight, ChevronLeft, RefreshCw, Plus } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import AddAccountTypeModal from './AddAccountTypeModal'
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
        <div className="flex items-center gap-1.5 mt-0.5 min-h-[16px]">
          {isDepository && item.subtype && (
            <span
              className="px-1 py-0 rounded text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)',
                color: 'var(--text-muted)',
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
        style={{ color: 'var(--text-primary)' }}
      >
        {formatCurrency(Math.abs(item.balance || 0))}
      </span>
    </button>
  )
}

function AccountGroup({ label, icon: Icon, iconColor, items, subtotal, subtotalColor, selectedCardId, onSelectCard, isDepository, customizations, people, persistKey }) {
  const [open, setOpen] = usePersistedState(persistKey, true)

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
  collapsed = false, onCollapsedChange,
  snapTrade,
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [addAccountOpen, setAddAccountOpen] = useState(false)

  // Ensure Plaid accounts are loaded so linkedItems has live balances
  useEffect(() => {
    if (plaid && !plaid.hasFetched && plaid.fetchAccounts) {
      plaid.fetchAccounts()
    }
  }, [plaid])

  // Map plaidAccountId → parent Plaid item info (for disconnect feature)
  const plaidAccountToItem = useMemo(() => {
    const map = new Map()
    // Primary source: live Plaid linkedItems
    if (plaid?.linkedItems) {
      for (const item of plaid.linkedItems) {
        for (const acct of item.accounts || []) {
          if (!acct.id) continue
          map.set(acct.id, {
            itemId: item.itemId,
            institutionName: item.institutionName,
            siblingAccounts: item.accounts,
          })
        }
      }
    }
    // Fallback: accounts that have stored plaidItemId from sync
    // (handles cases where /plaid/accounts fails or hasn't loaded yet)
    for (const card of creditCards) {
      if (card.plaidAccountId && card.plaidItemId && !map.has(card.plaidAccountId)) {
        map.set(card.plaidAccountId, {
          itemId: card.plaidItemId,
          institutionName: card.plaidInstitutionName || card.name,
          siblingAccounts: [],
        })
      }
    }
    for (const acct of savingsAccounts) {
      if (acct.plaidAccountId && acct.plaidItemId && !map.has(acct.plaidAccountId)) {
        map.set(acct.plaidAccountId, {
          itemId: acct.plaidItemId,
          institutionName: acct.plaidInstitutionName || acct.name,
          siblingAccounts: [],
        })
      }
    }
    return map
  }, [plaid?.linkedItems, creditCards, savingsAccounts])

  // Handle disconnecting a Plaid institution with optional data removal
  const handleDisconnectAccount = useCallback(async ({ itemId, removeData }) => {
    // Capture affected plaidAccountIds before disconnect removes them from state
    const targetItem = plaid?.linkedItems?.find(i => i.itemId === itemId)
    const affectedPlaidIds = new Set(
      (targetItem?.accounts || []).map(a => a.id).filter(Boolean)
    )

    await plaid.disconnect(itemId)

    if (removeData) {
      // Find local account IDs that map to affected plaid accounts
      const affectedLocalIds = new Set()
      for (const card of creditCards) {
        if (card.plaidAccountId && affectedPlaidIds.has(card.plaidAccountId)) {
          affectedLocalIds.add(card.id)
        }
      }
      for (const sa of savingsAccounts) {
        if (sa.plaidAccountId && affectedPlaidIds.has(sa.plaidAccountId)) {
          affectedLocalIds.add(sa.id)
        }
      }

      // Remove credit cards tied to this institution
      if (onCreditCardsChange) {
        onCreditCardsChange(prev => prev.filter(c => !affectedPlaidIds.has(c.plaidAccountId)))
      }
      // Remove savings accounts tied to this institution
      if (onSavingsChange) {
        onSavingsChange(prev => prev.filter(s => !affectedPlaidIds.has(s.plaidAccountId)))
      }
      // Clean up customizations for affected accounts
      if (onAccountCustomizationsChange && affectedLocalIds.size > 0) {
        const cleaned = { ...accountCustomizations }
        for (const id of affectedLocalIds) {
          delete cleaned[id]
        }
        onAccountCustomizationsChange(cleaned)
      }
      // Refresh statement index
      if (onStatementsRefresh) {
        onStatementsRefresh()
      }
    }
  }, [plaid, creditCards, savingsAccounts, onCreditCardsChange, onSavingsChange, accountCustomizations, onAccountCustomizationsChange, onStatementsRefresh])

  // Map plaidAccountId → live balance from Plaid linkedItems
  const plaidBalanceMap = useMemo(() => {
    const map = new Map()
    if (!plaid?.linkedItems) return map
    for (const item of plaid.linkedItems) {
      for (const acct of item.accounts || []) {
        if (!acct.id) continue
        if (acct.type === 'depository') {
          map.set(acct.id, acct.availableBalance ?? acct.currentBalance ?? 0)
        } else {
          map.set(acct.id, Math.abs(acct.currentBalance ?? 0))
        }
      }
    }
    return map
  }, [plaid?.linkedItems])

  // Build bank accounts list (same logic as CreditCardHubPage)
  const plaidBankAccountIds = useMemo(() => new Set(
    (statementIndex?.statements || [])
      .filter(s => s.source === 'plaid' && s.accountType === 'depository')
      .map(s => s.plaidAccountId)
  ), [statementIndex])

  const bankAccounts = useMemo(() => {
    const stateAccounts = savingsAccounts
      .filter(sa => sa.plaidAccountId && plaidBankAccountIds.has(sa.plaidAccountId))
      .map(sa => {
        const stmts = (statementIndex?.statements || []).filter(s => s.cardId === sa.id)
        const liveBal = sa.plaidAccountId ? plaidBalanceMap.get(sa.plaidAccountId) : undefined
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
          balance: liveBal ?? sa.amount,
          isDepository: true,
          statementCount: stmts.length,
          subtype,
        }
      })

    // Include depository accounts from statementIndex that aren't in savingsAccounts state
    const stateCardIds = new Set(stateAccounts.map(a => a.id))
    const indexDepositoryAccounts = (statementIndex?.statements || [])
      .filter(s => s.source === 'plaid' && s.accountType === 'depository')
    const seenCardIds = new Set()
    for (const s of indexDepositoryAccounts) {
      if (stateCardIds.has(s.cardId) || seenCardIds.has(s.cardId)) continue
      seenCardIds.add(s.cardId)
      const stmts = (statementIndex?.statements || []).filter(st => st.cardId === s.cardId)
      stateAccounts.push({
        id: s.cardId,
        name: s.accountName || 'Bank Account',
        balance: (s.plaidAccountId && plaidBalanceMap.has(s.plaidAccountId))
          ? plaidBalanceMap.get(s.plaidAccountId)
          : Math.abs(s.statementBalance || 0),
        isDepository: true,
        statementCount: stmts.length,
        subtype: s.accountSubtype || null,
        last4: s.cardLastFour || null,
        plaidAccountId: s.plaidAccountId,
      })
    }
    return stateAccounts
  }, [savingsAccounts, plaidBankAccountIds, statementIndex, plaidBalanceMap])

  const allCards = useMemo(() => {
    const stateCards = creditCards.map(card => {
      const stmts = (statementIndex?.statements || []).filter(s => s.cardId === card.id)
      const liveBal = card.plaidAccountId ? plaidBalanceMap.get(card.plaidAccountId) : undefined
      return {
        ...card,
        balance: liveBal ?? card.balance,
        statementCount: stmts.length,
        isDepository: false,
      }
    })

    // Include credit accounts from statementIndex that aren't in creditCards state
    const stateCardIds = new Set(stateCards.map(c => c.id))
    const indexCreditAccounts = (statementIndex?.statements || [])
      .filter(s => s.source === 'plaid' && s.accountType === 'credit')
    const seenCardIds = new Set()
    for (const s of indexCreditAccounts) {
      if (stateCardIds.has(s.cardId) || seenCardIds.has(s.cardId)) continue
      seenCardIds.add(s.cardId)
      const stmts = (statementIndex?.statements || []).filter(st => st.cardId === s.cardId)
      stateCards.push({
        id: s.cardId,
        name: s.accountName || s.issuer || 'Credit Card',
        balance: (s.plaidAccountId && plaidBalanceMap.has(s.plaidAccountId))
          ? plaidBalanceMap.get(s.plaidAccountId)
          : Math.abs(s.statementBalance || 0),
        creditLimit: 0,
        isDepository: false,
        statementCount: stmts.length,
        last4: s.cardLastFour || null,
        plaidAccountId: s.plaidAccountId,
      })
    }
    return stateCards
  }, [creditCards, statementIndex, plaidBalanceMap])

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

  const hiddenCount = Object.values(accountCustomizations).filter(c => c.hidden).length

  // ---- Desktop collapsed sidebar ----
  const desktopCollapsed = (
    <aside
      className="hidden xl:flex flex-col items-center fixed z-40 rounded-xl"
      style={{
        top: '5.5rem',
        left: '0.75rem',
        width: '2.75rem',
        maxHeight: 'calc(100vh - 7rem)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
      }}
      aria-label="Accounts sidebar (collapsed)"
    >
      <button
        onClick={() => onCollapsedChange?.(false)}
        className="flex items-center justify-center w-full py-3 transition-colors rounded-t-xl"
        style={{ color: 'var(--text-muted)' }}
        title="Expand accounts"
      >
        <ChevronRight size={16} />
      </button>
      <div
        className="flex-1 flex items-center justify-center"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider select-none"
          style={{ color: 'var(--text-muted)', transform: 'rotate(180deg)' }}
        >
          Accounts
        </span>
      </div>
      <div className="py-3 text-center">
        <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {formatCurrency(totalBalance)}
        </span>
      </div>
    </aside>
  )

  // ---- Desktop sidebar ----
  const desktopSidebar = collapsed ? desktopCollapsed : (
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
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onCollapsedChange?.(true)}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Collapse sidebar"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Accounts
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { if (!plaid?.syncing) onSync?.() }}
              className="p-1 rounded transition-colors"
              style={{ color: plaid?.syncing ? 'var(--accent-blue)' : 'var(--text-muted)' }}
              title="Refresh transactions"
              disabled={plaid?.syncing}
            >
              <RefreshCw size={14} className={plaid?.syncing ? 'animate-spin' : ''} />
            </button>
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
          persistKey="burndown_collapse_credit_cards"
        />

        {cards.length > 0 && visibleBankAccounts.length > 0 && (
          <div className="my-1 mx-3" style={{ borderTop: '1px solid var(--border-subtle)' }} />
        )}

        <AccountGroup
          label="Banking"
          icon={Landmark}
          iconColor="var(--text-muted)"
          items={visibleBankAccounts}
          subtotal={bankSubtotal}
          subtotalColor="var(--text-primary)"
          selectedCardId={selectedCardId}
          onSelectCard={onSelectCard}
          isDepository={true}
          customizations={accountCustomizations}
          people={people}
          persistKey="burndown_collapse_banking"
        />
      </div>

      {/* Hidden accounts indicator */}
      {hiddenCount > 0 && (
        <div className="shrink-0 px-3 py-1.5" style={{ borderTop: '1px solid var(--border-default)' }}>
          <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
            {hiddenCount} hidden acct{hiddenCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Add Account row */}
      {plaid && (
        <div className="shrink-0" style={{ borderTop: '1px solid var(--border-default)' }}>
          <button
            onClick={() => setAddAccountOpen(true)}
            disabled={plaid.syncing}
            className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all rounded-lg"
            style={{
              background: 'transparent',
              borderLeft: '2px solid transparent',
              opacity: plaid.syncing ? 0.6 : 1,
              cursor: plaid.syncing ? 'wait' : 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 6%, var(--bg-card))' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            title="Add a bank, credit card, or investment account"
          >
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' }}
            >
              <Plus size={10} style={{ color: 'var(--accent-blue)' }} />
            </span>
            <span className="text-xs" style={{ color: 'var(--accent-blue)' }}>
              {plaid.syncing ? 'Syncing...' : 'Add Account'}
            </span>
          </button>
        </div>
      )}
    </aside>
  )

  // ---- Mobile compact pills (< xl) ----
  const mobileBanner = (
    <div className="xl:hidden space-y-3">
      {/* Compact account pills */}
      <div className="flex flex-wrap gap-1.5">
        {/* Refresh button for mobile */}
        <button
          onClick={() => { if (!plaid?.syncing) onSync?.() }}
          className="flex items-center justify-center px-2 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border-input)', background: 'var(--bg-input)', color: plaid?.syncing ? 'var(--accent-blue)' : 'var(--text-muted)' }}
          title="Refresh transactions"
          disabled={plaid?.syncing}
        >
          <RefreshCw size={12} className={plaid?.syncing ? 'animate-spin' : ''} />
        </button>
        {/* Settings gear for mobile */}
        <button
          onClick={() => setCustomizeOpen(true)}
          className="flex items-center justify-center px-2 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-muted)' }}
          title="Customize accounts"
        >
          <Settings size={12} />
        </button>
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
              <Landmark size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="truncate max-w-[120px]">{displayName}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatCurrency(item.balance || 0)}</span>
            </button>
          )
        })}

        {/* Add Account pill */}
        {plaid && (
          <button
            onClick={() => setAddAccountOpen(true)}
            disabled={plaid.syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{
              borderColor: 'var(--accent-blue)',
              background: 'rgba(59, 130, 246, 0.1)',
              color: 'var(--accent-blue)',
              opacity: plaid.syncing ? 0.6 : 1,
              cursor: plaid.syncing ? 'wait' : 'pointer',
            }}
            title="Add a bank, credit card, or investment account"
          >
            <Plus size={12} />
            <span>{plaid.syncing ? 'Syncing...' : 'Add Account'}</span>
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {desktopSidebar}
      {mobileBanner}

      {/* Add account type selection modal */}
      <AddAccountTypeModal
        open={addAccountOpen}
        onClose={() => setAddAccountOpen(false)}
        plaid={plaid}
        onSync={onSync}
        snapTrade={snapTrade}
      />

      {/* Customize modal */}
      <AccountCustomizeModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        creditCards={allCards}
        bankAccounts={bankAccounts}
        customizations={accountCustomizations}
        onCustomizationsChange={onAccountCustomizationsChange}
        people={people}
        plaidAccountToItem={plaidAccountToItem}
        onDisconnectAccount={handleDisconnectAccount}
      />
    </>
  )
}
