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
import TransactionLinkModal from '../components/linking/TransactionLinkModal'
import CCPaymentPicklistModal from '../components/linking/CCPaymentPicklistModal'
import { detectCCPayments } from '../utils/ccPaymentDetector'
import { picklistForCCPayment } from '../utils/ccStatementPicklist'

export default function CreditCardHubPage({
  creditCards, people = [], plaid, savingsAccounts = [],
  onCreditCardsChange, onSavingsChange, user,
  oneTimePurchases = [], oneTimeExpenses = [], oneTimeIncome = [],
  transactionLinks = {}, onLinkTransaction, onUnlinkTransaction,
  onAllTransactionsChange,
  expenses = [], subscriptions = [], monthlyBenefits = 0, totalMonthlyIncome = 0,
  transactionOverrides = {}, onTransactionOverride,
  jobs = [],
}) {
  const [searchParams] = useSearchParams()
  const initialCardId = searchParams.get('card')
  const [selectedCardId, setSelectedCardId] = useState(
    initialCardId ? Number(initialCardId) : null
  )
  const [linkModalTxn, setLinkModalTxn] = useState(null)
  const [ccPicklistTxn, setCCPicklistTxn] = useState(null)

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

  // Collect all transactions from loaded statements, applying any user overrides
  const allTransactions = useMemo(() => {
    const txns = []
    const relevantStmts = (index?.statements || [])
      .filter(s => selectedCardId === null || s.cardId === selectedCardId)

    for (const stmtMeta of relevantStmts) {
      const full = statements[stmtMeta.id]
      if (!full?.transactions) continue
      for (const txn of full.transactions) {
        const override = transactionOverrides[txn.id]
        txns.push({
          ...txn,
          cardId: full.cardId,
          cardLastFour: full.cardLastFour || null,
          accountType: full.accountType || null,
          accountSubtype: full.accountSubtype || null,
          accountName: full.accountName || null,
          ...(override || {}),
        })
      }
    }
    return txns
  }, [index, statements, selectedCardId, transactionOverrides])

  // Collect ALL transactions across all accounts (unfiltered, for linking)
  const allTransactionsUnfiltered = useMemo(() => {
    const txns = []
    for (const stmtMeta of (index?.statements || [])) {
      const full = statements[stmtMeta.id]
      if (!full?.transactions) continue
      for (const txn of full.transactions) {
        txns.push({
          ...txn,
          cardId: full.cardId,
          cardLastFour: full.cardLastFour || null,
          accountType: full.accountType || null,
          accountSubtype: full.accountSubtype || null,
          accountName: full.accountName || null,
        })
      }
    }
    return txns
  }, [index, statements])

  // Stable transaction count from the index (doesn't depend on lazy-loaded statement data)
  const totalTransactionCount = useMemo(() => {
    return (index?.statements || [])
      .filter(s => selectedCardId === null || s.cardId === selectedCardId)
      .reduce((sum, s) => sum + (s.transactionCount || 0), 0)
  }, [index, selectedCardId])

  // Propagate allTransactions to parent for overview usage
  useEffect(() => {
    if (onAllTransactionsChange && allTransactionsUnfiltered.length > 0) {
      onAllTransactionsChange(allTransactionsUnfiltered)
    }
  }, [allTransactionsUnfiltered]) // eslint-disable-line

  // Reverse-lookup map: transactionId → overviewKey
  const txnToOverviewMap = useMemo(() => {
    const map = {}
    for (const [overviewKey, links] of Object.entries(transactionLinks)) {
      for (const link of links) {
        map[link.transactionId] = overviewKey
      }
    }
    return map
  }, [transactionLinks])

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

  // When a CC payment is clicked, detect which card it matches and load the statement
  const handleOpenCCPicklist = useCallback(async (bankTxn) => {
    if (!index?.statements?.length) return
    const detected = detectCCPayments([bankTxn], creditCards, index.statements)
    const match = detected[0]
    if (!match?.matchedCardId) {
      // Still show the modal even without a match — user sees "no match found"
      setCCPicklistTxn({ bankTxn, matchedCardId: null, matchedCardName: null })
      return
    }
    // Ensure the matched statement is loaded
    const picklist = picklistForCCPayment({
      bankTxn,
      matchedCardId: match.matchedCardId,
      statementIndex: index.statements,
      statements,
    })
    if (picklist.statement && !statements[picklist.statement.id]) {
      await loadStatement(picklist.statement.id)
    }
    setCCPicklistTxn({ bankTxn, matchedCardId: match.matchedCardId, matchedCardName: match.matchedCardName })
  }, [index, creditCards, statements, loadStatement])

  // Compute picklist data reactively (re-runs when statements load)
  const ccPicklistData = useMemo(() => {
    if (!ccPicklistTxn?.matchedCardId) return null
    return picklistForCCPayment({
      bankTxn: ccPicklistTxn.bankTxn,
      matchedCardId: ccPicklistTxn.matchedCardId,
      statementIndex: index?.statements || [],
      statements,
    })
  }, [ccPicklistTxn, index, statements])

  // Show skeleton while statement index is loading
  if (loading && !index) return <CreditCardHubSkeleton />

  const hasOneTimeItems = oneTimePurchases.length > 0 || oneTimeExpenses.length > 0 || oneTimeIncome.length > 0

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
          {plaid && (
            <div>
              <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Banks Connected</p>
              <p className="text-xl font-semibold" style={{ color: 'var(--accent-emerald)' }}>{plaid.linkedItems.length}</p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Statements</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--accent-blue)' }}>{index?.statements?.length || 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Transactions</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{totalTransactionCount}</p>
          </div>
        </div>

        {/* Add Bank + Sync controls */}
        {plaid && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
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
      </div>

      {/* Card / account selector */}
      <SectionCard title="Your Accounts">
        <StatementImportStatus
          statementIndex={index}
          loading={loading}
          error={error}
          onRefresh={refreshIndex}
        />
        {allAccounts.length > 0 ? (
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
            user={user}
          />
        ) : (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No accounts configured yet. Add cards in the{' '}
            <a href="/" className="underline" style={{ color: 'var(--accent-blue)' }}>
              burndown tracker
            </a>{' '}
            or connect a bank above to get started.
          </p>
        )}
      </SectionCard>

      {/* Spending charts */}
      <StatementChartTabs
        transactions={allTransactions}
        creditCards={creditCards}
        expenses={expenses}
        subscriptions={subscriptions}
        monthlyIncome={totalMonthlyIncome}
        monthlyBenefits={monthlyBenefits}
        onTransactionUpdate={onTransactionOverride}
        oneTimePurchases={oneTimePurchases}
        oneTimeExpenses={oneTimeExpenses}
        oneTimeIncome={oneTimeIncome}
        transactionLinks={transactionLinks}
        txnToOverviewMap={txnToOverviewMap}
        onLinkTransaction={onLinkTransaction}
        onUnlinkTransaction={onUnlinkTransaction}
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
          user={user}
        />
      </SectionCard>

      {/* Transaction table */}
      <SectionCard title="Transactions">
        <TransactionTable
          transactions={allTransactions}
          txnToOverviewMap={hasOneTimeItems ? txnToOverviewMap : undefined}
          onOpenLinkModal={hasOneTimeItems ? setLinkModalTxn : undefined}
          onOpenCCPicklist={creditCards.length > 0 ? handleOpenCCPicklist : undefined}
          jobs={jobs}
          transactionOverrides={transactionOverrides}
          onTransactionOverride={onTransactionOverride}
        />
      </SectionCard>

      {/* Transaction link modal */}
      {linkModalTxn && (
        <TransactionLinkModal
          open={true}
          transaction={linkModalTxn}
          oneTimePurchases={oneTimePurchases}
          oneTimeExpenses={oneTimeExpenses}
          oneTimeIncome={oneTimeIncome}
          transactionLinks={transactionLinks}
          txnToOverviewMap={txnToOverviewMap}
          onLink={(overviewKey, txn) => {
            onLinkTransaction(overviewKey, txn)
            setLinkModalTxn(null)
          }}
          onUnlink={(overviewKey, txnId) => {
            onUnlinkTransaction(overviewKey, txnId)
            setLinkModalTxn(null)
          }}
          onClose={() => setLinkModalTxn(null)}
        />
      )}

      {/* CC Payment → Statement breakdown modal */}
      {ccPicklistTxn && (
        <CCPaymentPicklistModal
          open={true}
          bankTxn={ccPicklistTxn.bankTxn}
          matchedCardName={ccPicklistTxn.matchedCardName}
          coverage={ccPicklistData?.coverage || null}
          transactions={ccPicklistData?.transactions || []}
          onClose={() => setCCPicklistTxn(null)}
        />
      )}

      <p className="text-center text-xs text-faint pb-4">
        Statement data is stored separately and loaded on demand from S3.
      </p>
    </main>
  )
}
