import { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { DEFAULTS } from '../constants/defaults'
import { useBurndown } from '../hooks/useBurndown'
import { useTemplates } from '../hooks/useTemplates'
import { useActivityLog } from '../hooks/useActivityLog'
import { useS3Storage } from '../hooks/useS3Storage'
import { useSnapshots } from '../hooks/useSnapshots'
import { usePlaid } from '../hooks/usePlaid'
import { useSnapTrade } from '../hooks/useSnapTrade'
import { useOrgMembers } from '../hooks/useOrgMembers'
import { useStatementStorage } from '../hooks/useStatementStorage'
import { useBudget } from '../hooks/useBudget'
import { useTrackedState } from '../hooks/useTrackedState'
import { useTransactionLinks as useTransactionLinksHook } from '../hooks/useTransactionLinks'
import { useScenarioComputations } from '../hooks/useScenarioComputations'
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning'
import { validateSyncState } from '../utils/validateSyncState'
import { getEffectivePayment } from '../utils/ccPayment'
import { isCCPayment } from '../utils/ccPaymentDetector'

// Migrate old job scenario shape to enhanced model (backward compat)
function migrateJobScenario(s) {
  let migrated = s
  if (migrated.grossAnnualSalary == null) {
    migrated = {
      ...migrated,
      grossAnnualSalary: (migrated.monthlyTakeHome || 0) * 12,
      usState: '',
      taxRatePct: 0,
      savingsAllocation: 0,
      savingsAllocationType: 'dollar',
      investmentAllocation: 0,
      investmentAllocationType: 'dollar',
    }
  }
  return {
    signingBonus: 0,
    annualBonusPct: 0,
    employerBenefitsMonthly: 0,
    employer401kMatchPct: 0,
    equityAnnual: 0,
    commuteMonthly: 0,
    ...migrated,
  }
}

const FinancialDataContext = createContext(null)

export function useFinancialData() {
  const ctx = useContext(FinancialDataContext)
  if (!ctx) throw new Error('useFinancialData must be used within a FinancialDataProvider')
  return ctx
}

export function FinancialDataProvider({ user, children }) {
  // ---------------------------------------------------------------------------
  // Core financial state (25+ pieces)
  // ---------------------------------------------------------------------------
  const [furloughDate, setFurloughDate] = useState(DEFAULTS.furloughDate)
  const [people, setPeople] = useState(DEFAULTS.people)
  const [savingsAccounts, setSavingsAccounts] = useState(DEFAULTS.savingsAccounts)
  const [unemployment, setUnemployment] = useState(DEFAULTS.unemployment)
  const [expenses, setExpenses] = useState(DEFAULTS.expenses)
  const [whatIf, setWhatIf] = useState(DEFAULTS.whatIf)
  const [oneTimeExpenses, setOneTimeExpenses] = useState(DEFAULTS.oneTimeExpenses)
  const [oneTimePurchases, setOneTimePurchases] = useState(DEFAULTS.oneTimePurchases)
  const [assets, setAssets] = useState(DEFAULTS.assets)
  const [investments, setInvestments] = useState(DEFAULTS.investments)
  const [child1Investments, setChild1Investments] = useState(DEFAULTS.child1Investments)
  const [child2Investments, setChild2Investments] = useState(DEFAULTS.child2Investments)
  const [subscriptions, setSubscriptions] = useState(DEFAULTS.subscriptions)
  const [creditCards, setCreditCards] = useState(DEFAULTS.creditCards)
  const [oneTimeIncome, setOneTimeIncome] = useState(DEFAULTS.oneTimeIncome)
  const [monthlyIncome, setMonthlyIncome] = useState(DEFAULTS.monthlyIncome)
  const [jobs, setJobs] = useState(DEFAULTS.jobs)
  const [jobScenarios, setJobScenarios] = useState(DEFAULTS.jobScenarios)
  const [retirement, setRetirement] = useState(DEFAULTS.retirement)
  const [properties, setProperties] = useState(DEFAULTS.properties)
  const [homeImprovements, setHomeImprovements] = useState(DEFAULTS.homeImprovements)
  const [goals, setGoals] = useState(DEFAULTS.goals)
  const [advertisingRevenue, setAdvertisingRevenue] = useState(DEFAULTS.advertisingRevenue)
  const [comments, setComments] = useState({})
  const [filterPersonId, setFilterPersonId] = useState(null)
  const [notificationPreferences, setNotificationPreferences] = useState(DEFAULTS.notificationPreferences)
  const [transactionLinks, setTransactionLinks] = useState(DEFAULTS.transactionLinks)
  const [transactionOverrides, setTransactionOverrides] = useState(DEFAULTS.transactionOverrides)
  const [accountCustomizations, setAccountCustomizations] = useState(DEFAULTS.accountCustomizations || {})
  const [categoryBudgets, setCategoryBudgets] = useState(DEFAULTS.categoryBudgets || {})

  // ---------------------------------------------------------------------------
  // Templates & activity log
  // ---------------------------------------------------------------------------
  const {
    templates,
    activeTemplateId,
    setActiveTemplateId,
    saveNew,
    overwrite,
    rename,
    remove,
    getSnapshot,
    duplicate,
    bulkLoad,
    updateSnapshot,
  } = useTemplates()

  const { entries: logEntries, addEntry, clearLog, loadEntries, userName, setUserName } = useActivityLog(user?.userId)

  // ---------------------------------------------------------------------------
  // Tracked state (change logging + dirty tracking)
  // ---------------------------------------------------------------------------
  const stateMap = {
    savingsAccounts:    [savingsAccounts, setSavingsAccounts],
    expenses:           [expenses, setExpenses],
    unemployment:       [unemployment, setUnemployment],
    furloughDate:       [furloughDate, setFurloughDate],
    people:             [people, setPeople],
    whatIf:             [whatIf, setWhatIf],
    oneTimeExpenses:    [oneTimeExpenses, setOneTimeExpenses],
    oneTimePurchases:   [oneTimePurchases, setOneTimePurchases],
    oneTimeIncome:      [oneTimeIncome, setOneTimeIncome],
    monthlyIncome:      [monthlyIncome, setMonthlyIncome],
    jobs:               [jobs, setJobs],
    assets:             [assets, setAssets],
    investments:        [investments, setInvestments],
    child1Investments:  [child1Investments, setChild1Investments],
    child2Investments:  [child2Investments, setChild2Investments],
    subscriptions:      [subscriptions, setSubscriptions],
    creditCards:        [creditCards, setCreditCards],
    jobScenarios:       [jobScenarios, setJobScenarios],
    retirement:         [retirement, setRetirement],
    properties:         [properties, setProperties],
    homeImprovements:   [homeImprovements, setHomeImprovements],
    goals:              [goals, setGoals],
    advertisingRevenue: [advertisingRevenue, setAdvertisingRevenue],
  }

  const { tracked, dirtySections, hasDirtyChanges, setHasDirtyChanges } = useTrackedState(stateMap, addEntry)
  useUnsavedChangesWarning(hasDirtyChanges)

  // Expose tracked change handlers with the same names App.jsx used
  const onSavingsChange = tracked.savingsAccounts
  const onExpensesChange = tracked.expenses
  const onUnemploymentChange = tracked.unemployment
  const onFurloughChange = tracked.furloughDate
  const onPeopleChange = tracked.people
  const onWhatIfChange = tracked.whatIf
  const onOneTimeExpChange = tracked.oneTimeExpenses
  const onOneTimePurchChange = tracked.oneTimePurchases
  const onOneTimeIncChange = tracked.oneTimeIncome
  const onMonthlyIncChange = tracked.monthlyIncome
  const onJobsChange = tracked.jobs
  const onAssetsChange = tracked.assets
  const onInvestmentsChange = tracked.investments
  const onChild1InvestmentsChange = tracked.child1Investments
  const onChild2InvestmentsChange = tracked.child2Investments
  const onSubsChange = tracked.subscriptions
  const onCreditCardsChange = tracked.creditCards
  const onJobScenariosChange = tracked.jobScenarios
  const onRetirementChange = tracked.retirement
  const onPropertiesChange = tracked.properties
  const onHomeImprovementsChange = tracked.homeImprovements
  const onGoalsChange = tracked.goals
  const onAdvertisingRevenueChange = tracked.advertisingRevenue

  function onCategoryBudgetsChange(updater) {
    const next = typeof updater === 'function' ? updater(categoryBudgets) : updater
    setCategoryBudgets(next)
    dirtySections.current.add('Category budgets')
    setHasDirtyChanges(true)
  }

  // ---------------------------------------------------------------------------
  // Transaction link/override handlers
  // ---------------------------------------------------------------------------
  const {
    txnToOverviewMap,
    handleLinkTransaction,
    handleUnlinkTransaction,
    handleTransactionOverride,
  } = useTransactionLinksHook({
    transactionLinks,
    setTransactionLinks,
    transactionOverrides,
    setTransactionOverrides,
    dirtySections,
    setHasDirtyChanges,
  })

  // ---------------------------------------------------------------------------
  // Cloud storage (S3) + snapshots
  // ---------------------------------------------------------------------------
  const s3Storage = useS3Storage()
  const snapshots = useSnapshots()
  const [dataReady, setDataReady] = useState(false)
  const [historicalDate, setHistoricalDate] = useState(null)
  const [historicalSnapshot, setHistoricalSnapshot] = useState(null)

  // ---------------------------------------------------------------------------
  // Snapshot build / apply
  // ---------------------------------------------------------------------------
  function buildSnapshot() {
    return { furloughDate, people, savingsAccounts, unemployment, expenses, whatIf, oneTimeExpenses, oneTimePurchases, oneTimeIncome, monthlyIncome, jobs, assets, investments, child1Investments, child2Investments, subscriptions, creditCards, jobScenarios, retirement, properties, homeImprovements, goals, advertisingRevenue, transactionLinks, transactionOverrides, accountCustomizations, categoryBudgets, plaidSnapshotMeta: (plaid?.linkedItems || []).map(i => ({ itemId: i.itemId, institutionName: i.institutionName, accountCount: i.accounts?.length || 0, lastSync: i.lastSync })) }
  }

  function applySnapshot(snapshot) {
    if (!snapshot) return
    if (snapshot.furloughDate) setFurloughDate(snapshot.furloughDate)
    if (snapshot.people) setPeople(snapshot.people)
    if (snapshot.savingsAccounts) setSavingsAccounts(snapshot.savingsAccounts)
    if (snapshot.unemployment) setUnemployment(snapshot.unemployment)
    if (snapshot.expenses) setExpenses(snapshot.expenses)
    if (snapshot.whatIf) setWhatIf({ ...DEFAULTS.whatIf, ...snapshot.whatIf })
    if (snapshot.oneTimeExpenses) setOneTimeExpenses(snapshot.oneTimeExpenses)
    if (snapshot.oneTimePurchases) setOneTimePurchases(snapshot.oneTimePurchases)
    if (snapshot.oneTimeIncome) setOneTimeIncome(snapshot.oneTimeIncome)
    if (snapshot.monthlyIncome) setMonthlyIncome(snapshot.monthlyIncome)
    if (snapshot.jobs) setJobs(snapshot.jobs)
    if (snapshot.assets) setAssets(snapshot.assets)
    if (snapshot.investments) setInvestments(snapshot.investments)
    if (snapshot.child1Investments) setChild1Investments(snapshot.child1Investments)
    if (snapshot.child2Investments) setChild2Investments(snapshot.child2Investments)
    if (snapshot.subscriptions) setSubscriptions(snapshot.subscriptions)
    if (snapshot.creditCards) setCreditCards(snapshot.creditCards)
    if (snapshot.jobScenarios) setJobScenarios(snapshot.jobScenarios.map(migrateJobScenario))
    if (snapshot.retirement) setRetirement({ ...DEFAULTS.retirement, ...snapshot.retirement })
    if (snapshot.properties) setProperties(snapshot.properties)
    if (snapshot.homeImprovements) setHomeImprovements(snapshot.homeImprovements)
    if (snapshot.goals) setGoals(snapshot.goals)
    if (snapshot.advertisingRevenue) setAdvertisingRevenue(snapshot.advertisingRevenue)
    if (snapshot.transactionLinks) setTransactionLinks(snapshot.transactionLinks)
    if (snapshot.transactionOverrides) setTransactionOverrides(snapshot.transactionOverrides)
    if (snapshot.accountCustomizations) setAccountCustomizations(snapshot.accountCustomizations)
    if (snapshot.categoryBudgets) setCategoryBudgets(snapshot.categoryBudgets)
  }

  function buildFullState() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      state: buildSnapshot(),
      templates,
      activeTemplateId,
      comments,
      activityLog: logEntries,
      notificationPreferences,
    }
  }

  function applyFullState(data) {
    if (!data) return
    if (data.state) applySnapshot(data.state)
    if (Array.isArray(data.templates)) bulkLoad(data.templates)
    if (data.activeTemplateId != null) setActiveTemplateId(data.activeTemplateId)
    if (data.comments && typeof data.comments === 'object') setComments(data.comments)
    if (Array.isArray(data.activityLog)) loadEntries(data.activityLog)
    if (data.notificationPreferences) {
      const np = data.notificationPreferences
      setNotificationPreferences({
        ...DEFAULTS.notificationPreferences,
        ...np,
        thresholds: { ...DEFAULTS.notificationPreferences.thresholds, ...np.thresholds },
        push: { ...DEFAULTS.notificationPreferences.push, ...np.push },
        categoryAlerts: np.categoryAlerts || DEFAULTS.notificationPreferences.categoryAlerts,
      })
    }
  }

  // Apply only the fields that a Plaid/SnapTrade sync actually modifies (balances)
  function applySyncState(data) {
    if (!data?.state) return
    const validated = validateSyncState(data.state)
    if (!validated) {
      console.warn('applySyncState: sync data failed validation, skipping update')
      return
    }
    if (validated.savingsAccounts) setSavingsAccounts(validated.savingsAccounts)
    if (validated.creditCards) setCreditCards(validated.creditCards)
    if (validated.investments) setInvestments(validated.investments)
  }

  // ---------------------------------------------------------------------------
  // Plaid + SnapTrade integrations
  // ---------------------------------------------------------------------------
  const handlePlaidSync = (updatedFullState) => {
    if (updatedFullState) {
      applySyncState(updatedFullState)
      addEntry('sync', 'Plaid sync: balances updated from bank')
    }
  }
  const plaid = usePlaid({ onSyncComplete: handlePlaidSync })

  const handleSnapTradeSync = (updatedFullState) => {
    if (updatedFullState) {
      applySyncState(updatedFullState)
      addEntry('sync', 'SnapTrade sync: investment balances updated from brokerage')
    }
  }
  const snapTrade = useSnapTrade({ onSyncComplete: handleSnapTradeSync })
  const tierGatedPlaid = user?.tier === 'premium' ? plaid : null
  const tierGatedSnapTrade = user?.tier === 'premium' ? snapTrade : null
  const { membersByUserId } = useOrgMembers(user)

  // ---------------------------------------------------------------------------
  // Statement storage
  // ---------------------------------------------------------------------------
  const { index: statementIndex, statements: appStatements, loading: statementsLoading, error: statementsError, loadStatement: appLoadStatement, refreshIndex: refreshStatementIndex } = useStatementStorage()

  // Eagerly load all statements
  useEffect(() => {
    if (!statementIndex?.statements?.length) return
    for (const s of statementIndex.statements) {
      if (!appStatements[s.id]) appLoadStatement(s.id)
    }
  }, [statementIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build allTransactionsCache from loaded statements
  const appAllTransactions = useMemo(() => {
    const txns = []
    for (const stmtMeta of (statementIndex?.statements || [])) {
      const full = appStatements[stmtMeta.id]
      if (!full?.transactions) continue
      for (const txn of full.transactions) {
        const merged = {
          ...txn,
          cardId: full.cardId,
          cardLastFour: full.cardLastFour || null,
          accountType: full.accountType || null,
          accountSubtype: full.accountSubtype || null,
          accountName: accountCustomizations[full.cardId]?.nickname || full.accountName || null,
        }
        if (isCCPayment(merged)) {
          merged.category = 'ccPayment'
        }
        txns.push(merged)
      }
    }
    return txns
  }, [statementIndex, appStatements, accountCustomizations])

  const [allTransactionsCache, setAllTransactionsCache] = useState([])
  const effectiveTransactions = appAllTransactions.length > 0 ? appAllTransactions : allTransactionsCache

  // ---------------------------------------------------------------------------
  // Restore from S3 on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (s3Storage.restoreData) {
      applyFullState(s3Storage.restoreData)
      s3Storage.clearRestoreData()
      addEntry('load', 'Data loaded from cloud')
      setDataReady(true)
    } else if (s3Storage.status === 'connected') {
      setDataReady(true)
    } else if (s3Storage.status === 'error') {
      console.warn('[App] S3 storage failed to load — using local defaults')
      setDataReady(true)
    }
  }, [s3Storage.restoreData, s3Storage.status]) // eslint-disable-line

  // Auto-save to S3 on state change (debounced 3 s, only when sections are dirty)
  const autoSaveTimer = useRef(null)
  useEffect(() => {
    if (s3Storage.status === 'loading') return
    if (dirtySections.current.size === 0) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      s3Storage.save(buildFullState())
      snapshots.saveSnapshot(buildSnapshot())
      addEntry('save', `Auto-saved: ${[...dirtySections.current].join(', ')}`)
      dirtySections.current.clear()
    }, 3000)
    return () => clearTimeout(autoSaveTimer.current)
  }, [furloughDate, people, savingsAccounts, unemployment, expenses, whatIf, oneTimeExpenses, oneTimePurchases, oneTimeIncome, monthlyIncome, jobs, assets, investments, child1Investments, child2Investments, subscriptions, creditCards, jobScenarios, retirement, properties, homeImprovements, goals, advertisingRevenue, templates, comments, transactionLinks, transactionOverrides, accountCustomizations, notificationPreferences, categoryBudgets]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Template handlers
  // ---------------------------------------------------------------------------
  function handleSave(id)      { overwrite(id, buildSnapshot()); addEntry('save', `Template "${templates.find(t => t.id === id)?.name || id}" overwritten`) }
  function handleSaveNew(name) { saveNew(name, buildSnapshot()); addEntry('save', `New template "${name}" saved`) }
  function handleLoad(id) {
    const snapshot = getSnapshot(id)
    applySnapshot(snapshot)
    setActiveTemplateId(id)
    addEntry('load', `Template "${templates.find(t => t.id === id)?.name || id}" loaded`)
  }

  // ---------------------------------------------------------------------------
  // Plaid global sync
  // ---------------------------------------------------------------------------
  async function handleGlobalSync(itemId) {
    if (!plaid) return
    await plaid.syncAll(itemId)
    refreshStatementIndex()
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const totalSavings = savingsAccounts
    .filter(a => a.active !== false)
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

  const assetProceeds = assets
    .filter(a => a.includedInWhatIf)
    .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0)

  const derivedStartDate = useMemo(() => {
    const statusDates = jobs
      .filter(j => j.status !== 'active' && j.statusDate)
      .map(j => j.statusDate)
      .sort()
    return statusDates.length > 0 ? statusDates[0] : null
  }, [jobs])

  const effectiveStartDate = furloughDate || derivedStartDate || dayjs().format('YYYY-MM-DD')

  // Merge active subscriptions + credit card payments into expenses
  const expensesWithSubs = [
    ...expenses,
    ...subscriptions
      .filter(s => s.active !== false)
      .map(s => ({ id: `sub_${s.id}`, category: s.name, monthlyAmount: s.monthlyAmount, essential: false })),
    ...creditCards
      .filter(c => getEffectivePayment(c) > 0)
      .map(c => {
        const pmt = getEffectivePayment(c)
        const label = c.paymentStrategy === 'full' ? 'full bal.' : c.paymentStrategy === 'fixed' ? 'fixed pmt' : 'min. payment'
        return { id: `cc_${c.id}`, category: `${c.name} (${label})`, monthlyAmount: pmt, essential: true }
      }),
  ]

  const allInvestments = [...investments, ...child1Investments, ...child2Investments]

  const adCostsAsExpenses = (advertisingRevenue?.costs ?? [])
    .filter(c => c.monthlyAmount)
    .map(c => ({ id: `adcost_${c.id}`, category: c.description || 'Ad Cost', monthlyAmount: c.monthlyAmount, essential: false, assignedTo: c.assignedTo }))
  const expensesForBurndown = [...expensesWithSubs, ...adCostsAsExpenses]
  const monthlyIncomeForBurndown = [...monthlyIncome, ...(advertisingRevenue?.revenue ?? [])]

  // ---------------------------------------------------------------------------
  // Burndown calculations
  // ---------------------------------------------------------------------------
  const baseWhatIf = { ...DEFAULTS.whatIf }
  const base = useBurndown(totalSavings, unemployment, expensesForBurndown, baseWhatIf, oneTimeExpenses, 0, allInvestments, oneTimeIncome, monthlyIncomeForBurndown, effectiveStartDate, jobs, oneTimePurchases, creditCards)
  const current = useBurndown(totalSavings, unemployment, expensesForBurndown, whatIf, oneTimeExpenses, assetProceeds, allInvestments, oneTimeIncome, monthlyIncomeForBurndown, effectiveStartDate, jobs, oneTimePurchases, creditCards)

  // ---------------------------------------------------------------------------
  // Scenario computations (templates, job scenarios, historical)
  // ---------------------------------------------------------------------------
  const { templateResults, jobScenarioResults, historicalBurndown } = useScenarioComputations({
    templates,
    jobScenarios,
    whatIf,
    totalSavings,
    unemployment,
    expensesWithSubs,
    expensesForBurndown,
    oneTimeExpenses,
    oneTimePurchases,
    assetProceeds,
    investments,
    allInvestments,
    oneTimeIncome,
    monthlyIncome,
    monthlyIncomeForBurndown,
    furloughDate,
    creditCards,
    historicalDate,
    historicalSnapshot,
  })

  const handleHistoricalDateSelect = async (date) => {
    if (!date) {
      setHistoricalDate(null)
      setHistoricalSnapshot(null)
      return
    }
    const data = await snapshots.loadSnapshot(date)
    if (data?.state) {
      setHistoricalDate(date)
      setHistoricalSnapshot(data.state)
    }
  }

  const hasWhatIf =
    whatIf.expenseReductionPct > 0 ||
    (whatIf.expenseRaisePct || 0) > 0 ||
    whatIf.sideIncomeMonthly > 0 ||
    assetProceeds > 0 ||
    (Number(whatIf.emergencyFloor) || 0) > 0 ||
    (Number(whatIf.benefitDelayWeeks) || 0) > 0 ||
    (Number(whatIf.benefitCutWeeks) || 0) > 0 ||
    !!whatIf.freezeDate ||
    (whatIf.freelanceRamp || []).some(t => (Number(t.monthlyAmount) || 0) > 0) ||
    ((Number(whatIf.partnerIncomeMonthly) || 0) > 0 && !!whatIf.partnerStartDate)

  // Budget variance for notifications
  const { variance: budgetVarianceData } = useBudget(categoryBudgets, effectiveTransactions, transactionOverrides)

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------
  const value = {
    // Raw state
    furloughDate, people, savingsAccounts, unemployment, expenses, whatIf,
    oneTimeExpenses, oneTimePurchases, assets, investments, child1Investments,
    child2Investments, subscriptions, creditCards, oneTimeIncome, monthlyIncome,
    jobs, jobScenarios, retirement, properties, homeImprovements, goals,
    advertisingRevenue, comments, filterPersonId, notificationPreferences,
    transactionLinks, transactionOverrides, accountCustomizations, categoryBudgets,

    // Raw setters (for cases that bypass tracking, e.g. sync)
    setComments, setNotificationPreferences, setAccountCustomizations,
    setFilterPersonId, setWhatIf,

    // Tracked change handlers
    onSavingsChange, onExpensesChange, onUnemploymentChange, onFurloughChange,
    onPeopleChange, onWhatIfChange, onOneTimeExpChange, onOneTimePurchChange,
    onOneTimeIncChange, onMonthlyIncChange, onJobsChange, onAssetsChange,
    onInvestmentsChange, onChild1InvestmentsChange, onChild2InvestmentsChange,
    onSubsChange, onCreditCardsChange, onJobScenariosChange, onRetirementChange,
    onPropertiesChange, onHomeImprovementsChange, onGoalsChange,
    onAdvertisingRevenueChange, onCategoryBudgetsChange,

    // Transaction link handlers
    txnToOverviewMap, handleLinkTransaction, handleUnlinkTransaction, handleTransactionOverride,

    // Derived values
    totalSavings, assetProceeds, derivedStartDate, effectiveStartDate,
    expensesWithSubs, allInvestments, expensesForBurndown, monthlyIncomeForBurndown,
    hasWhatIf,

    // Burndown results
    base, current,

    // Scenario results
    templateResults, jobScenarioResults, historicalBurndown,
    historicalDate, handleHistoricalDateSelect,

    // Templates
    templates, activeTemplateId, setActiveTemplateId,
    handleSave, handleSaveNew, handleLoad, getSnapshot,
    rename, remove, duplicate, updateSnapshot,

    // Activity log
    logEntries, addEntry, clearLog, userName, setUserName,

    // Cloud save
    s3Storage, dataReady,

    // Snapshots
    snapshots,

    // Integrations
    plaid, snapTrade, tierGatedPlaid, tierGatedSnapTrade,
    membersByUserId,
    handleGlobalSync,

    // Statement storage
    statementIndex, statementsLoading, statementsError, refreshStatementIndex,

    // Transactions
    effectiveTransactions, setAllTransactionsCache,

    // Budget
    budgetVarianceData,

    // What-if reset
    onWhatIfReset: () => {
      const snap = activeTemplateId ? getSnapshot(activeTemplateId) : null
      setWhatIf(snap?.whatIf ? { ...DEFAULTS.whatIf, ...snap.whatIf } : DEFAULTS.whatIf)
    },
  }

  return (
    <FinancialDataContext.Provider value={value}>
      {children}
    </FinancialDataContext.Provider>
  )
}
