import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStatementStorage } from '../hooks/useStatementStorage'
import SectionCard from '../components/layout/SectionCard'
import StatementList from '../components/statements/StatementList'
import StatementChartTabs from '../components/statements/StatementChartTabs'
import TransactionTable from '../components/statements/TransactionTable'
import AccountsSidebar from '../components/statements/AccountsSidebar'
import CreditCardHubSkeleton from '../components/common/CreditCardHubSkeleton'
import TransactionLinkModal from '../components/linking/TransactionLinkModal'
import CCPaymentPicklistModal from '../components/linking/CCPaymentPicklistModal'
import { detectCCPayments, isCCPayment } from '../utils/ccPaymentDetector'
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
  accountCustomizations = {}, onAccountCustomizationsChange,
}) {
  const [searchParams] = useSearchParams()
  const initialCardId = searchParams.get('card')
  const [selectedCardId, setSelectedCardId] = useState(
    initialCardId ? Number(initialCardId) : null
  )
  const [linkModalTxn, setLinkModalTxn] = useState(null)
  const [ccPicklistTxn, setCCPicklistTxn] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const { index, statements, loading, error, loadStatement, refreshIndex, patchTransaction } = useStatementStorage()

  // Wrap override to also persist user modifications to the statement file
  const handleTransactionOverride = useCallback((txnId, updates, statementId) => {
    onTransactionOverride(txnId, updates)
    if (statementId) {
      patchTransaction(statementId, txnId, updates)
    }
  }, [onTransactionOverride, patchTransaction])

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
  }, [index, selectedCardId, statements, loadStatement])

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
        const merged = {
          ...txn,
          statementId: full.id,
          cardId: full.cardId,
          cardLastFour: full.cardLastFour || null,
          accountType: full.accountType || null,
          accountSubtype: full.accountSubtype || null,
          accountName: full.accountName || null,
          ...(override || {}),
        }
        // Auto-tag CC payment transactions unless user manually set a category
        if (!override?.category && isCCPayment(merged)) {
          merged.category = 'ccPayment'
        }
        txns.push(merged)
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
        const merged = {
          ...txn,
          cardId: full.cardId,
          cardLastFour: full.cardLastFour || null,
          accountType: full.accountType || null,
          accountSubtype: full.accountSubtype || null,
          accountName: full.accountName || null,
        }
        if (isCCPayment(merged)) {
          merged.category = 'ccPayment'
        }
        txns.push(merged)
      }
    }
    return txns
  }, [index, statements])

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
    <>
      {/* Left sidebar — desktop fixed, mobile inline pills */}
      <AccountsSidebar
        creditCards={creditCards}
        savingsAccounts={savingsAccounts}
        statementIndex={index}
        selectedCardId={selectedCardId}
        onSelectCard={setSelectedCardId}
        plaid={plaid}
        onSync={handleSync}
        people={people}
        user={user}
        onCreditCardsChange={onCreditCardsChange}
        onSavingsChange={onSavingsChange}
        onStatementsRefresh={refreshIndex}
        loading={loading}
        error={error}
        accountCustomizations={accountCustomizations}
        onAccountCustomizationsChange={onAccountCustomizationsChange}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <main className={`${sidebarCollapsed ? 'xl:ml-[3.75rem]' : 'xl:ml-[17rem]'} max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5 transition-[margin] duration-200`}>

      {/* Spending charts */}
      <StatementChartTabs
        transactions={allTransactions}
        creditCards={creditCards}
        expenses={expenses}
        subscriptions={subscriptions}
        monthlyIncome={totalMonthlyIncome}
        monthlyBenefits={monthlyBenefits}
        onTransactionUpdate={handleTransactionOverride}
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
          onTransactionOverride={handleTransactionOverride}
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
    </>
  )
}
