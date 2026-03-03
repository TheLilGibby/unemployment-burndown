import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStatementStorage } from '../hooks/useStatementStorage'
import SectionCard from '../components/layout/SectionCard'
import CardOverviewBanner from '../components/statements/CardOverviewBanner'
import StatementList from '../components/statements/StatementList'
import StatementChartTabs from '../components/statements/StatementChartTabs'
import TransactionTable from '../components/statements/TransactionTable'
import StatementImportStatus from '../components/statements/StatementImportStatus'
import PlaidLinkButton from '../components/plaid/PlaidLinkButton'
import CreditCardHubSkeleton from '../components/common/CreditCardHubSkeleton'

export default function CreditCardHubPage({ creditCards, people = [], plaid, savingsAccounts = [], onCreditCardsChange, onSavingsChange }) {
  const [searchParams] = useSearchParams()
  const initialCardId = searchParams.get('card')
  const [selectedCardId, setSelectedCardId] = useState(
    initialCardId ? Number(initialCardId) : null
  )

  const { index, statements, loading, error, loadStatement, refreshIndex } = useStatementStorage()

  // Wrap syncAll to also refresh the statement index after sync
  const handleSync = useCallback(async (itemId) => {
    if (!plaid) return
    await plaid.syncAll(itemId)
    refreshIndex()
  }, [plaid, refreshIndex])

  // Load all statement details for the selected card(s)
  useEffect(() => {
    if (!index?.statements?.length) return
    const toLoad = index.statements
      .filter(s => selectedCardId === null || s.cardId === selectedCardId)
    for (const s of toLoad) {
      if (!statements[s.id]) loadStatement(s.id)
    }
  }, [index, selectedCardId]) // eslint-disable-line

  // Collect all transactions from loaded statements
  const allTransactions = useMemo(() => {
    const txns = []
    const relevantStmts = (index?.statements || [])
      .filter(s => selectedCardId === null || s.cardId === selectedCardId)

    for (const stmtMeta of relevantStmts) {
      const full = statements[stmtMeta.id]
      if (!full?.transactions) continue
      for (const txn of full.transactions) {
        txns.push({ ...txn, cardId: full.cardId })
      }
    }
    return txns
  }, [index, statements, selectedCardId])

  // Build unified account list: credit cards + Plaid-linked bank accounts with statements
  const allAccounts = useMemo(() => {
    const accounts = [...creditCards]
    const plaidStmtAccountIds = new Set(
      (index?.statements || [])
        .filter(s => s.source === 'plaid' && s.accountType === 'depository')
        .map(s => s.plaidAccountId)
    )
    for (const sa of savingsAccounts) {
      if (sa.plaidAccountId && plaidStmtAccountIds.has(sa.plaidAccountId)) {
        accounts.push({
          id: sa.id,
          name: sa.name,
          balance: sa.amount,
          last4: null,
          creditLimit: 0,
          isDepository: true,
          plaidAccountId: sa.plaidAccountId,
        })
      }
    }
    return accounts
  }, [creditCards, savingsAccounts, index])

  // Show skeleton while statement index is loading
  if (loading && !index) return <CreditCardHubSkeleton />

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5">

      {/* Hero banner — mirrors RunwayBanner / JobScenariosPage structure */}
      <div className="theme-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--accent-blue)' }} />
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Transaction Hub
          </h2>
        </div>

        <p className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {allAccounts.length} {allAccounts.length === 1 ? 'Account' : 'Accounts'}
        </p>
        <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
          Unified view of spending across all your accounts
        </p>

        <div className="flex flex-wrap gap-6 sm:gap-10 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Statements</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--accent-blue)' }}>{index?.statements?.length || 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Transactions</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{allTransactions.length}</p>
          </div>
        </div>
      </div>

      {/* Plaid connection bar */}
      {plaid && (
        <div
          className="rounded-xl border px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
        >
          <PlaidLinkButton
            createLinkToken={plaid.createLinkToken}
            exchangeToken={plaid.exchangeToken}
            syncAll={handleSync}
            linkedCount={plaid.linkedItems.length}
            syncing={plaid.syncing}
          />
          {plaid.linkedItems.length > 0 && (
            <button
              onClick={() => handleSync()}
              disabled={plaid.syncing}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{
                borderColor: plaid.syncing ? 'var(--border-subtle)' : 'var(--accent-blue)',
                color: plaid.syncing ? 'var(--text-muted)' : 'var(--accent-blue)',
                background: plaid.syncing ? 'transparent' : 'rgba(59, 130, 246, 0.08)',
                cursor: plaid.syncing ? 'wait' : 'pointer',
              }}
            >
              {plaid.syncing ? 'Syncing...' : 'Sync Transactions'}
            </button>
          )}
          {plaid.lastSync && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Last synced: {new Date(plaid.lastSync).toLocaleString()}
            </span>
          )}
          {plaid.error && (
            <span className="text-xs" style={{ color: '#f87171' }}>{plaid.error}</span>
          )}
        </div>
      )}

      {/* Import status */}
      <StatementImportStatus
        statementIndex={index}
        loading={loading}
        error={error}
        onRefresh={refreshIndex}
      />

      {/* Card / account selector */}
      {allAccounts.length > 0 ? (
        <SectionCard title="Your Accounts">
          <CardOverviewBanner
            creditCards={creditCards}
            savingsAccounts={savingsAccounts}
            statementIndex={index}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            people={people}
            onCreditCardsChange={onCreditCardsChange}
            onSavingsChange={onSavingsChange}
            onStatementsRefresh={refreshIndex}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Your Accounts">
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No accounts configured yet. Add cards in the{' '}
            <a href="/" className="underline" style={{ color: 'var(--accent-blue)' }}>
              burndown tracker
            </a>{' '}
            or connect a bank above to get started.
          </p>
        </SectionCard>
      )}

      {/* Spending charts */}
      <StatementChartTabs
        transactions={allTransactions}
        creditCards={creditCards}
      />

      {/* Statement list */}
      <SectionCard title="Statements">
        <StatementList
          statementIndex={index}
          creditCards={creditCards}
          savingsAccounts={savingsAccounts}
          people={people}
          selectedCardId={selectedCardId}
          onLoadStatement={loadStatement}
        />
      </SectionCard>

      {/* Transaction table */}
      <SectionCard title="Transactions">
        <TransactionTable transactions={allTransactions} />
      </SectionCard>

      <p className="text-center text-xs text-faint pb-4">
        Statement data is stored separately and loaded on demand from S3.
      </p>
    </main>
  )
}
