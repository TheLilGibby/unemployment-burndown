import { useState, useMemo, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import { DEFAULTS } from './constants/defaults'
import { useBurndown } from './hooks/useBurndown'
import { useTemplates } from './hooks/useTemplates'
import { useActivityLog } from './hooks/useActivityLog'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/auth/LoginScreen'
import Header from './components/layout/Header'
import TemplateManager from './components/templates/TemplateManager'
import PersonFilter from './components/people/PersonFilter'
import PresentationMode from './components/presentation/PresentationMode'

import TableOfContents from './components/layout/TableOfContents'
import ViewMenu from './components/layout/ViewMenu'
import CloudSaveStatus from './components/layout/CloudSaveStatus'
import ActivityLogPanel from './components/layout/ActivityLogPanel'
import FinancialSidebar from './components/layout/FinancialSidebar'
import BurndownPage from './pages/BurndownPage'
import CreditCardHubPage from './pages/CreditCardHubPage'
import JobScenariosPage from './components/scenarios/JobScenariosPage'
import UserProfilePage from './pages/UserProfilePage'
import RetirementPage from './pages/RetirementPage'
import GoalsPage from './pages/GoalsPage'
import ComparativeAnalysisPage from './pages/ComparativeAnalysisPage'
import BudgetPage from './pages/BudgetPage'
import NetWorthDashboardPage from './pages/NetWorthDashboardPage'
import AccountsSidebar from './components/statements/AccountsSidebar'
import { useBudget } from './hooks/useBudget'
import { useStatementStorage } from './hooks/useStatementStorage'
import { useS3Storage } from './hooks/useS3Storage'
import { useSnapshots } from './hooks/useSnapshots'
import { usePlaid } from './hooks/usePlaid'
import { useSnapTrade } from './hooks/useSnapTrade'
import { useOrgMembers } from './hooks/useOrgMembers'
import { diffArray, diffObject, diffPrimitive } from './utils/diffSection'
import { validateSyncState } from './utils/validateSyncState'
import { getEffectivePayment } from './utils/ccPayment'
import { isCCPayment } from './utils/ccPaymentDetector'
import { CommentsProvider } from './context/CommentsContext'
import CommentsPanel from './components/comments/CommentsPanel'
import ConnectedAccountsPanel from './components/plaid/ConnectedAccountsPanel'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import SuperAdminToolsPage from './pages/SuperAdminToolsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import OrgSetup from './components/auth/OrgSetup'
import AcceptInvite from './components/auth/AcceptInvite'
import SuperAdminPage from './pages/SuperAdminPage'
import NotFoundPage from './pages/NotFoundPage'
import ImpersonationBanner from './components/admin/ImpersonationBanner'
import OrgSettings from './components/org/OrgSettings'
import ProfileMenu from './components/profile/ProfileMenu'
import { NotificationsProvider } from './context/NotificationsContext'
import { ToastProvider } from './context/ToastContext'
import NotificationBell from './components/notifications/NotificationBell'
import NotificationPanel from './components/notifications/NotificationPanel'
import ToastContainer from './components/notifications/ToastContainer'
import { Search } from 'lucide-react'
import CommandPalette from './components/layout/CommandPalette'
import ErrorBoundary from './components/common/ErrorBoundary'
import AppLoadingSkeleton from './components/common/AppLoadingSkeleton'
import BurndownPageSkeleton from './components/common/BurndownPageSkeleton'
import { SkeletonStyles } from './components/common/Skeleton'

// Migrate old job scenario shape to enhanced model (backward compat)
function migrateJobScenario(s) {
  let migrated = s
  // v1 migration: add gross salary fields
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
  // v2 migration: add compensation package fields (defaults first, then spread saved data)
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

// ---------------------------------------------------------------------------
// Pure burndown computation (mirrors useBurndown logic without React hooks).
// Used inside useMemo to compute template results for the Compare tab.
// ---------------------------------------------------------------------------
function computeBurndown(savings, unemployment, expenses, whatIf, oneTimeExpenses, extraCash, investments, oneTimeIncome = [], monthlyIncome = [], startDate = null, jobs = [], oneTimePurchases = [], creditCards = []) {
  const today = dayjs(startDate || new Date())

  const rawBenefitStart = dayjs(unemployment.startDate)
  const delayWeeks = Number(whatIf.benefitDelayWeeks) || 0
  const cutWeeks   = Number(whatIf.benefitCutWeeks)   || 0
  const benefitStart = rawBenefitStart.add(delayWeeks, 'week')
  const baseDuration = Math.max(0, unemployment.durationWeeks - cutWeeks)
  const benefitEnd   = benefitStart.add(baseDuration, 'week')
  const monthlyBenefits = unemployment.weeklyAmount * (52 / 12)

  const essentialTotal    = expenses.filter(e => e.essential).reduce((s, e)  => s + (Number(e.monthlyAmount) || 0), 0)
  const nonEssentialTotal = expenses.filter(e => !e.essential).reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)
  const reductionFactor   = 1 - (whatIf.expenseReductionPct || 0) / 100
  const raiseFactor       = 1 + (whatIf.expenseRaisePct || 0) / 100
  const effectiveExpenses = (essentialTotal + nonEssentialTotal * reductionFactor) * raiseFactor

  const sideIncome         = Number(whatIf.sideIncomeMonthly) || 0
  const monthlyInvestments = investments.filter(inv => inv.active).reduce((s, inv) => s + (Number(inv.monthlyAmount) || 0), 0)
  const emergencyFloor     = Number(whatIf.emergencyFloor) || 0
  const freezeDate         = whatIf.freezeDate ? dayjs(whatIf.freezeDate) : null
  const partnerIncome      = Number(whatIf.partnerIncomeMonthly) || 0
  const partnerStartDate   = whatIf.partnerStartDate ? dayjs(whatIf.partnerStartDate) : null
  const freelanceRamp      = Array.isArray(whatIf.freelanceRamp) ? whatIf.freelanceRamp : []
  const jobSalary          = Number(whatIf.jobOfferSalary) || 0
  const jobStartDate       = whatIf.jobOfferStartDate ? dayjs(whatIf.jobOfferStartDate) : null
  const jobAnnualRaisePct  = Number(whatIf.jobOfferAnnualRaisePct) || 0

  // Compensation package fields
  const jobOfferSigningBonus   = Number(whatIf.jobOfferSigningBonus) || 0
  const jobOfferAnnualBonusPct = Number(whatIf.jobOfferAnnualBonusPct) || 0
  const jobOfferBenefitsOffset = Number(whatIf.jobOfferBenefitsOffset) || 0
  const jobOfferEquityAnnual   = Number(whatIf.jobOfferEquityAnnual) || 0
  const jobOfferCommuteMonthly = Number(whatIf.jobOfferCommuteMonthly) || 0
  const jobOfferGrossAnnual    = Number(whatIf.jobOfferGrossAnnual) || 0
  const jobOfferTaxRatePct     = Number(whatIf.jobOfferTaxRatePct) || 0

  function jobIncomeForDate(d) {
    let total = 0
    for (const job of jobs) {
      if (!job.monthlySalary) continue
      if (job.startDate && dayjs(job.startDate).isAfter(d)) continue
      if (job.endDate) {
        if (dayjs(job.endDate).isBefore(d)) continue
      } else {
        if (job.status !== 'active') continue
      }
      total += Number(job.monthlySalary) || 0
    }
    return total
  }

  const oneTimeByMonth = {}
  for (const ote of (oneTimeExpenses || [])) {
    if (!ote.date || !ote.amount) continue
    const oteDate = dayjs(ote.date)
    if (oteDate.isBefore(today)) continue
    const slot = Math.max(1, oteDate.diff(today, 'month') + 1)
    oneTimeByMonth[slot] = (oneTimeByMonth[slot] || 0) + (Number(ote.amount) || 0)
  }
  // Merge one-time purchases into the same expense map (they are also losses)
  for (const otp of (oneTimePurchases || [])) {
    if (!otp.date || !otp.amount) continue
    const otpDate = dayjs(otp.date)
    if (otpDate.isBefore(today)) continue
    const slot = Math.max(1, otpDate.diff(today, 'month') + 1)
    oneTimeByMonth[slot] = (oneTimeByMonth[slot] || 0) + (Number(otp.amount) || 0)
  }

  const oneTimeIncomeByMonth = {}
  for (const oti of (oneTimeIncome || [])) {
    if (!oti.date || !oti.amount) continue
    const otiDate = dayjs(oti.date)
    if (otiDate.isBefore(today)) continue
    const slot = Math.max(1, otiDate.diff(today, 'month') + 1)
    oneTimeIncomeByMonth[slot] = (oneTimeIncomeByMonth[slot] || 0) + (Number(oti.amount) || 0)
  }

  let ccBals = creditCards.map(c => ({
    id: c.id, balance: Number(c.balance) || 0,
    apr: Number(c.apr) || 0,
    payment: getEffectivePayment(c),
    strategy: c.paymentStrategy || 'minimum',
  }))
  const initDebt = ccBals.reduce((s, cc) => s + cc.balance, 0)

  const MAX_MONTHS = 120
  let balance = (Number(savings) || 0) + (Number(extraCash) || 0)
  const dataPoints = [{
    date: today.toDate(), dateLabel: today.format('MMM YYYY'),
    balance: Math.round(Math.max(0, balance - emergencyFloor)),
    rawBalance: Math.round(balance), month: 0,
    totalDebt: Math.round(initDebt),
    netPosition: Math.round(Math.max(0, balance - emergencyFloor) - initDebt),
  }]

  let runoutDate = null, runoutMonth = null

  for (let i = 1; i <= MAX_MONTHS; i++) {
    const currentDate = today.add(i, 'month')
    const inBenefitWindow = currentDate.isAfter(benefitStart) && currentDate.isBefore(benefitEnd)
    let income = inBenefitWindow ? monthlyBenefits : 0
    const jobIncomeThisMonth = jobIncomeForDate(currentDate)
    income += jobIncomeThisMonth
    const jobOfferActive = jobStartDate && !currentDate.isBefore(jobStartDate)
    if (jobOfferActive) {
      const monthsSinceStart = currentDate.diff(jobStartDate, 'month')
      const fullYears = Math.floor(monthsSinceStart / 12)
      const raiseF = (jobAnnualRaisePct > 0 && fullYears > 0)
        ? Math.pow(1 + jobAnnualRaisePct / 100, fullYears) : 1
      income += jobSalary * raiseF
      // Signing bonus: one-time income in the first month
      if (jobOfferSigningBonus > 0 && monthsSinceStart === 0) income += jobOfferSigningBonus
      // Annual bonus: paid at each yearly anniversary
      if (jobOfferAnnualBonusPct > 0 && monthsSinceStart > 0 && monthsSinceStart % 12 === 0) {
        const bonusNet = jobOfferGrossAnnual * raiseF * (jobOfferAnnualBonusPct / 100) * (1 - jobOfferTaxRatePct / 100)
        income += bonusNet
      }
      // Equity/RSU vesting: distributed monthly
      if (jobOfferEquityAnnual > 0) income += jobOfferEquityAnnual / 12
    }
    if (jobIncomeThisMonth === 0 && !jobOfferActive) income += sideIncome
    const partnerActive = partnerStartDate && !currentDate.isBefore(partnerStartDate)
    if (partnerActive) income += partnerIncome
    for (const src of monthlyIncome) {
      if (!src.monthlyAmount) continue
      if (src.startDate && dayjs(src.startDate).isAfter(currentDate)) continue
      if (src.endDate && dayjs(src.endDate).isBefore(currentDate)) continue
      income += Number(src.monthlyAmount) || 0
    }
    if (freelanceRamp.length > 0) {
      const activeTier = [...freelanceRamp].filter(t => t.monthOffset <= i).sort((a, b) => b.monthOffset - a.monthOffset)[0]
      if (activeTier) income += Number(activeTier.monthlyAmount) || 0
    }
    const afterFreeze = freezeDate ? !currentDate.isBefore(freezeDate) : true
    const expReductionFactor = afterFreeze ? reductionFactor : 1
    let monthExpenses = (essentialTotal + nonEssentialTotal * expReductionFactor) * raiseFactor
    // Compensation package adjustments to expenses
    if (jobOfferActive) {
      if (jobOfferBenefitsOffset > 0) monthExpenses = Math.max(0, monthExpenses - jobOfferBenefitsOffset)
      if (jobOfferCommuteMonthly > 0) monthExpenses += jobOfferCommuteMonthly
    }
    const oneTimeCost = oneTimeByMonth[i] || 0
    const oneTimeIncomeThisMonth = oneTimeIncomeByMonth[i] || 0
    const netBurn = monthExpenses + monthlyInvestments - income + oneTimeCost - oneTimeIncomeThisMonth
    const prevBalance = balance
    balance = balance - netBurn
    const effectiveBalance = balance - emergencyFloor
    const prevEffective = prevBalance - emergencyFloor
    if (effectiveBalance <= 0 && runoutDate === null) {
      const fraction = netBurn > 0
        ? Math.min(1, Math.max(0, prevEffective / netBurn))
        : 0
      const crossoverDate = today.add(i - 1 + fraction, 'month')
      runoutDate = crossoverDate.toDate()
      runoutMonth = i - 1 + fraction
    }
    // Update CC balances
    for (const cc of ccBals) {
      if (cc.balance <= 0) continue
      if (cc.strategy === 'full') { cc.balance = 0 }
      else {
        const interest = cc.balance * (cc.apr / 100 / 12)
        cc.balance = Math.max(0, cc.balance + interest - cc.payment)
      }
    }
    const totalDebt = ccBals.reduce((s, cc) => s + cc.balance, 0)
    dataPoints.push({
      date: currentDate.toDate(), dateLabel: currentDate.format('MMM YYYY'),
      balance: Math.max(0, Math.round(effectiveBalance)),
      rawBalance: Math.round(balance), month: i,
      oneTimeCost: oneTimeCost > 0 ? Math.round(oneTimeCost) : undefined,
      totalDebt: Math.round(totalDebt),
      netPosition: Math.round(Math.max(0, effectiveBalance) - totalDebt),
    })
    if (effectiveBalance <= 0 && i >= (runoutMonth || 0) + 3) break
  }

  const currentInBenefit = today.isAfter(benefitStart) && today.isBefore(benefitEnd)
  const currentJobIncome = jobIncomeForDate(today)
  const jobOfferActiveNow = jobStartDate && !today.isBefore(jobStartDate)
  let currentIncome = currentInBenefit ? monthlyBenefits : 0
  if (currentJobIncome > 0) currentIncome += currentJobIncome
  if (jobOfferActiveNow) {
    if (jobAnnualRaisePct > 0 && jobStartDate) {
      const monthsNow = today.diff(jobStartDate, 'month')
      const yearsNow = Math.floor(Math.max(0, monthsNow) / 12)
      currentIncome += yearsNow > 0 ? jobSalary * Math.pow(1 + jobAnnualRaisePct / 100, yearsNow) : jobSalary
    } else {
      currentIncome += jobSalary
    }
    if (jobOfferEquityAnnual > 0) currentIncome += jobOfferEquityAnnual / 12
  }
  if (currentJobIncome === 0 && !jobOfferActiveNow) currentIncome += sideIncome
  let currentEffExpenses = effectiveExpenses
  if (jobOfferActiveNow) {
    if (jobOfferBenefitsOffset > 0) currentEffExpenses = Math.max(0, currentEffExpenses - jobOfferBenefitsOffset)
    if (jobOfferCommuteMonthly > 0) currentEffExpenses += jobOfferCommuteMonthly
  }
  const currentNetBurn = currentEffExpenses + monthlyInvestments - currentIncome

  return {
    dataPoints, runoutDate, totalRunwayMonths: runoutMonth,
    currentNetBurn, effectiveExpenses, monthlyBenefits, monthlyInvestments,
    benefitEnd: benefitEnd.toDate(),
    benefitStart: benefitStart.toDate(),
    emergencyFloor,
  }
}

// ---------------------------------------------------------------------------

const DEFAULT_VIEW = {
  chartLines: { allExpenses: true, essentialsOnly: true, baseline: true },
  sections: {
    whatif:        true,
    subscriptions: true,
    creditCards:   true,
    investments:   true,
    onetimes:      true,
    onetimePurchases: true,
    onetimeIncome:   true,
    monthlyIncome:   true,
    advertisingRevenue: true,
    assets:          true,
    plaidAccounts:   true,
    transactions:    true,
  },
}

export default function App() {
  const { authed, user, error: authError, loading, mfaPending, hasOrg, impersonating, login, verifyMfa, register, logout, cancelMfa, createOrg, joinOrg, updateProfile, devLogin, forgotPassword, stopImpersonating } = useAuth()
  const location = useLocation()

  // Public pages accessible without authentication
  if (location.pathname === '/privacy') return <PrivacyPolicyPage />
  if (location.pathname === '/reset-password') return <ResetPasswordPage />
  if (location.pathname === '/accept-invite') return <AcceptInvite />

  // Show loading skeleton while checking token
  if (loading) return <AppLoadingSkeleton />

  if (!authed) return (
    <LoginScreen
      onLogin={login}
      onRegister={register}
      onVerifyMfa={verifyMfa}
      onCancelMfa={cancelMfa}
      onDevLogin={devLogin}
      onForgotPassword={forgotPassword}
      mfaPending={mfaPending}
      error={authError}
    />
  )

  // Superadmins can access the admin panel even without an org
  if (user?.isSuperAdmin && !hasOrg) return (
    <>
      {impersonating && <ImpersonationBanner user={user} onStop={stopImpersonating} />}
      <SuperAdminPage />
    </>
  )

  // User is authenticated but hasn't joined/created an org yet
  if (!hasOrg) return (
    <OrgSetup
      onCreateOrg={createOrg}
      onJoinOrg={joinOrg}
      onLogout={logout}
      error={authError}
    />
  )

  return <AuthenticatedApp logout={logout} user={user} updateProfile={updateProfile} impersonating={impersonating} stopImpersonating={stopImpersonating} />
}

function AuthenticatedApp({ logout, user, updateProfile, impersonating, stopImpersonating }) {
  const [presentationMode, setPresentationMode] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [orgOpen, setOrgOpen] = useState(false)
  const [viewSettings, setViewSettings] = useState(DEFAULT_VIEW)
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
  const [globalSelectedCardId, setGlobalSelectedCardId] = useState(null)
  const [globalSidebarCollapsed, setGlobalSidebarCollapsed] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)

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
  const dirtySections = useRef(new Set())

  // Cmd+K / Ctrl+K to open command palette
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdkOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const s3Storage = useS3Storage()
  const snapshots = useSnapshots()
  const [dataReady, setDataReady] = useState(false)
  const [historicalDate, setHistoricalDate] = useState(null)
  const [historicalSnapshot, setHistoricalSnapshot] = useState(null)

  // Plaid integration — auto-updates savings & credit card balances from bank data
  const handlePlaidSync = (updatedFullState) => {
    if (updatedFullState) {
      applySyncState(updatedFullState)
      addEntry('sync', 'Plaid sync: balances updated from bank')
    }
  }
  const plaid = usePlaid({ onSyncComplete: handlePlaidSync })

  // SnapTrade integration — auto-updates investment holdings from brokerage data
  const handleSnapTradeSync = (updatedFullState) => {
    if (updatedFullState) {
      applySyncState(updatedFullState)
      addEntry('sync', 'SnapTrade sync: investment balances updated from brokerage')
    }
  }
  const snapTrade = useSnapTrade({ onSyncComplete: handleSnapTradeSync })
  const { membersByUserId } = useOrgMembers(user)
  const { index: statementIndex, statements: appStatements, loading: statementsLoading, error: statementsError, loadStatement: appLoadStatement, refreshIndex: refreshStatementIndex } = useStatementStorage()

  // Eagerly load all statements so transactions are available on every page (e.g. Settings > Job History payroll drawer)
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

  // Keep allTransactionsCache in sync - prefer app-level data, allow CreditCardHubPage to update too
  const [allTransactionsCache, setAllTransactionsCache] = useState([])
  const effectiveTransactions = appAllTransactions.length > 0 ? appAllTransactions : allTransactionsCache

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
    // Merge snapshot whatIf with DEFAULTS so new fields always exist
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

  // Full state = live snapshot + saved templates (written to / read from file)
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

  // Apply only the fields that a Plaid/SnapTrade sync actually modifies (balances).
  // Using applyFullState here would overwrite transactionOverrides, transactionLinks,
  // and other user-edited state with stale data read from data.json at sync start.
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

  // When S3 storage loads data on mount, apply it.
  // Mark dataReady once restore has been applied (or confirmed absent) so the
  // page never renders with DEFAULTS before the real user data is in place.
  useEffect(() => {
    if (s3Storage.restoreData) {
      applyFullState(s3Storage.restoreData)
      s3Storage.clearRestoreData()
      addEntry('load', 'Data loaded from cloud')
      setDataReady(true)
    } else if (s3Storage.status === 'connected' || s3Storage.status === 'error') {
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
      snapshots.saveSnapshot(buildSnapshot()) // idempotent — server only writes once per day
      addEntry('save', `Auto-saved: ${[...dirtySections.current].join(', ')}`)
      dirtySections.current.clear()
    }, 3000)
    return () => clearTimeout(autoSaveTimer.current)
  }, [furloughDate, people, savingsAccounts, unemployment, expenses, whatIf, oneTimeExpenses, oneTimePurchases, oneTimeIncome, monthlyIncome, jobs, assets, investments, child1Investments, child2Investments, subscriptions, creditCards, jobScenarios, retirement, properties, homeImprovements, goals, advertisingRevenue, templates, comments, transactionLinks, transactionOverrides, accountCustomizations]) // eslint-disable-line

  function handleSave(id)      { overwrite(id, buildSnapshot()); addEntry('save', `Template "${templates.find(t => t.id === id)?.name || id}" overwritten`) }
  function handleSaveNew(name) { saveNew(name, buildSnapshot()); addEntry('save', `New template "${name}" saved`) }
  function handleLoad(id) {
    const snapshot = getSnapshot(id)
    applySnapshot(snapshot)
    setActiveTemplateId(id)
    addEntry('load', `Template "${templates.find(t => t.id === id)?.name || id}" loaded`)
  }

  // ---------------------------------------------------------------------------
  // Summarizers — convert state to a short display string for before/after logs
  // ---------------------------------------------------------------------------
  const _fmtM = (n) => '$' + Math.round(Math.abs(n)).toLocaleString()
  const _activeSum = (arr, key) => _fmtM(arr.filter(a => a.active !== false).reduce((s, a) => s + (Number(a[key]) || 0), 0))
  const _allSum    = (arr, key) => _fmtM(arr.reduce((s, a) => s + (Number(a[key]) || 0), 0))

  const summarizeSavings      = (v) => _activeSum(v, 'amount')
  const summarizeExpenses     = (v) => _allSum(v, 'monthlyAmount') + '/mo'
  const summarizeUnemployment = (v) => `$${v.weeklyAmount || 0}/wk × ${v.durationWeeks || 0}wks`
  const summarizeFurlough     = (v) => v || 'not set'
  const summarizePeople       = (v) => `${v.length} person${v.length !== 1 ? 's' : ''}`
  const summarizeWhatIf       = (v) => {
    const parts = []
    if (v.expenseReductionPct)                           parts.push(`${v.expenseReductionPct}% cut`)
    if (v.expenseRaisePct)                               parts.push(`+${v.expenseRaisePct}% raise`)
    if (v.sideIncomeMonthly)                             parts.push(`+${_fmtM(v.sideIncomeMonthly)}/mo side`)
    if (v.partnerIncomeMonthly && v.partnerStartDate)    parts.push(`partner ${_fmtM(v.partnerIncomeMonthly)}/mo`)
    if (v.emergencyFloor)                                parts.push(`floor ${_fmtM(v.emergencyFloor)}`)
    return parts.length ? parts.join(', ') : 'baseline'
  }
  const summarizeOneTimeExp   = (v) => `${v.length} item${v.length !== 1 ? 's' : ''} · ${_allSum(v, 'amount')}`
  const summarizeOneTimePurch = (v) => `${v.length} item${v.length !== 1 ? 's' : ''} · ${_allSum(v, 'amount')}`
  const summarizeOneTimeInc   = (v) => `${v.length} item${v.length !== 1 ? 's' : ''} · ${_allSum(v, 'amount')}`
  const summarizeMonthlyInc   = (v) => _allSum(v, 'monthlyAmount') + '/mo'
  const summarizeJobs         = (v) => {
    const now = dayjs()
    const isActive = (j) => {
      if (j.endDate && dayjs(j.endDate).isBefore(now)) return false
      if (!j.endDate && j.status !== 'active') return false
      return true
    }
    const active = v.filter(isActive).length
    const totalSalary = v.filter(isActive).reduce((s, j) => s + (Number(j.monthlySalary) || 0), 0)
    return `${active} active · ${_fmtM(totalSalary)}/mo`
  }
  const summarizeAssets       = (v) => `${v.length} asset${v.length !== 1 ? 's' : ''}`
  const summarizeInvestments  = (v) => _activeSum(v, 'monthlyAmount') + '/mo'
  const summarizeSubs         = (v) => _activeSum(v, 'monthlyAmount') + '/mo'
  const summarizeCCs          = (v) => {
    const total = v.reduce((s, c) => s + getEffectivePayment(c), 0)
    return _fmtM(total) + '/mo'
  }
  const summarizeAdvertisingRevenue = (v) => {
    const costTotal = (v?.costs || []).reduce((s, c) => s + (Number(c.monthlyAmount) || 0), 0)
    const revTotal  = (v?.revenue || []).reduce((s, r) => s + (Number(r.monthlyAmount) || 0), 0)
    return `spend ${_fmtM(costTotal)}/mo · revenue ${_fmtM(revTotal)}/mo`
  }
  const summarizeJobScenarios = (v) => `${v.length} scenario${v.length !== 1 ? 's' : ''}`
  const summarizeProperties      = (v) => `${v.length} propert${v.length !== 1 ? 'ies' : 'y'}`
  const summarizeHomeImprovements = (v) => `${v.length} item${v.length !== 1 ? 's' : ''} · ${_allSum(v, 'amount')}`
  const summarizeRetirement = (v) => {
    const target = v.targetMode === 'income'
      ? Math.round((Number(v.desiredAnnualIncome) || 0) / ((Number(v.withdrawalRatePct) || 4) / 100))
      : Number(v.targetNestEgg) || 0
    return `age ${v.currentAge}→${v.targetRetirementAge}, target ${_fmtM(target)}, ${_fmtM(v.monthlyContribution)}/mo`
  }

  // Tracked change handlers — capture before/after summary + granular diff details
  function track(getter, setter, label, summarize, diffFn) {
    return (v) => {
      try {
        const oldVal = getter()
        const before  = summarize ? summarize(oldVal) : null
        const after   = summarize ? summarize(v)      : null
        const details = diffFn   ? diffFn(oldVal, v)  : []
        if (before !== after || details.length > 0) {
          addEntry('change', label, { before, after, details })
        }
      } catch {}
      setter(v)
      dirtySections.current.add(label)
    }
  }
  const onSavingsChange      = track(() => savingsAccounts, setSavingsAccounts, 'Cash & savings',     summarizeSavings,      diffArray)
  const onExpensesChange     = track(() => expenses,        setExpenses,        'Monthly expenses',   summarizeExpenses,     diffArray)
  const onUnemploymentChange = track(() => unemployment,    setUnemployment,    'Unemployment',       summarizeUnemployment, diffObject)
  const onFurloughChange     = track(() => furloughDate,    setFurloughDate,    'Furlough date',      summarizeFurlough,     diffPrimitive)
  const onPeopleChange       = track(() => people,          setPeople,          'People',             summarizePeople,       diffArray)
  const onWhatIfChange       = track(() => whatIf,          setWhatIf,          'What-if scenarios',  summarizeWhatIf,       diffObject)
  const onOneTimeExpChange   = track(() => oneTimeExpenses, setOneTimeExpenses, 'One-time expenses',  summarizeOneTimeExp,   diffArray)
  const onOneTimePurchChange = track(() => oneTimePurchases, setOneTimePurchases, 'One-time purchases', summarizeOneTimePurch, diffArray)
  const onOneTimeIncChange   = track(() => oneTimeIncome,   setOneTimeIncome,   'One-time income',    summarizeOneTimeInc,   diffArray)
  const onMonthlyIncChange   = track(() => monthlyIncome,   setMonthlyIncome,   'Monthly income',     summarizeMonthlyInc,   diffArray)
  const onJobsChange         = track(() => jobs,            setJobs,            'Jobs',               summarizeJobs,         diffArray)
  const onAssetsChange       = track(() => assets,          setAssets,          'Assets',             summarizeAssets,       diffArray)
  const onInvestmentsChange  = track(() => investments,     setInvestments,     'Investments',        summarizeInvestments,  diffArray)
  const onChild1InvestmentsChange = track(() => child1Investments, setChild1Investments, 'Child [1] Investments', summarizeInvestments, diffArray)
  const onChild2InvestmentsChange = track(() => child2Investments, setChild2Investments, 'Child [2] Investments', summarizeInvestments, diffArray)
  const onSubsChange         = track(() => subscriptions,   setSubscriptions,   'Subscriptions',      summarizeSubs,         diffArray)
  const onCreditCardsChange  = track(() => creditCards,     setCreditCards,     'Credit cards',       summarizeCCs,          diffArray)
  const onJobScenariosChange = track(() => jobScenarios,    setJobScenarios,    'Job scenarios',      summarizeJobScenarios, diffArray)
  const onRetirementChange   = track(() => retirement,      setRetirement,      'Retirement plan',    summarizeRetirement,   diffObject)
  const onPropertiesChange        = track(() => properties,       setProperties,        'Properties',          summarizeProperties,        diffArray)
  const onHomeImprovementsChange  = track(() => homeImprovements, setHomeImprovements,  'Home improvements',   summarizeHomeImprovements,  diffArray)
  const summarizeGoals       = (v) => `${v.length} goal${v.length !== 1 ? 's' : ''}`
  const onGoalsChange        = track(() => goals,           setGoals,           'Goals',              summarizeGoals,        diffArray)
  const onAdvertisingRevenueChange = track(() => advertisingRevenue, setAdvertisingRevenue, 'Advertising revenue', summarizeAdvertisingRevenue, diffObject)

  function onCategoryBudgetsChange(updater) {
    const next = typeof updater === 'function' ? updater(categoryBudgets) : updater
    setCategoryBudgets(next)
    dirtySections.current.add('Category budgets')
  }

  // Transaction linking handlers
  const txnToOverviewMap = useMemo(() => {
    const map = {}
    for (const [overviewKey, links] of Object.entries(transactionLinks)) {
      for (const link of links) {
        map[link.transactionId] = overviewKey
      }
    }
    return map
  }, [transactionLinks])

  function handleLinkTransaction(overviewKey, txnSnapshot) {
    // Enforce: each transaction links to at most one overview item
    if (txnToOverviewMap[txnSnapshot.id || txnSnapshot.transactionId]) return
    setTransactionLinks(prev => ({
      ...prev,
      [overviewKey]: [
        ...(prev[overviewKey] || []),
        {
          transactionId: txnSnapshot.id || txnSnapshot.transactionId,
          linkedAt: new Date().toISOString(),
          amount: txnSnapshot.amount,
          date: txnSnapshot.date,
          merchantName: txnSnapshot.merchantName,
          description: txnSnapshot.description,
        }
      ]
    }))
    dirtySections.current.add('Transaction links')
  }

  function handleUnlinkTransaction(overviewKey, transactionId) {
    setTransactionLinks(prev => {
      const updated = { ...prev }
      updated[overviewKey] = (updated[overviewKey] || []).filter(l => l.transactionId !== transactionId)
      if (updated[overviewKey].length === 0) delete updated[overviewKey]
      return updated
    })
    dirtySections.current.add('Transaction links')
  }

  function handleTransactionOverride(txnId, updates) {
    setTransactionOverrides(prev => ({
      ...prev,
      [txnId]: { ...(prev[txnId] || {}), ...updates },
    }))
    dirtySections.current.add('Transaction overrides')
  }

  async function handleGlobalSync(itemId) {
    if (!plaid) return
    await plaid.syncAll(itemId)
    refreshStatementIndex()
  }

  // Derived: total cash from all active accounts
  const totalSavings = savingsAccounts
    .filter(a => a.active !== false)
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

  // Derived: total proceeds from assets toggled "Sell" in what-if
  const assetProceeds = assets
    .filter(a => a.includedInWhatIf)
    .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0)

  // Derived: auto-derive simulation start date from earliest job status change
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

  // Combine all investment arrays (parent + child) for burndown calculation
  const allInvestments = [...investments, ...child1Investments, ...child2Investments]

  // Merge advertising costs into expenses and ad revenue into monthly income for burndown
  const adCostsAsExpenses = (advertisingRevenue?.costs ?? [])
    .filter(c => c.monthlyAmount)
    .map(c => ({ id: `adcost_${c.id}`, category: c.description || 'Ad Cost', monthlyAmount: c.monthlyAmount, essential: false, assignedTo: c.assignedTo }))
  const expensesForBurndown = [...expensesWithSubs, ...adCostsAsExpenses]
  const monthlyIncomeForBurndown = [...monthlyIncome, ...(advertisingRevenue?.revenue ?? [])]

  // Base calculation (no what-if, no asset sales) — used for delta display
  const baseWhatIf = { ...DEFAULTS.whatIf }
  const base = useBurndown(totalSavings, unemployment, expensesForBurndown, baseWhatIf, oneTimeExpenses, 0, allInvestments, oneTimeIncome, monthlyIncomeForBurndown, effectiveStartDate, jobs, oneTimePurchases, creditCards)

  // With all what-if scenarios applied
  const current = useBurndown(totalSavings, unemployment, expensesForBurndown, whatIf, oneTimeExpenses, assetProceeds, allInvestments, oneTimeIncome, monthlyIncomeForBurndown, effectiveStartDate, jobs, oneTimePurchases, creditCards)

  // Pre-compute burndown results for every saved template (for Compare tab)
  const templateResults = useMemo(() => {
    const results = {}
    for (const t of templates) {
      const s = t.snapshot
      if (!s) continue
      const tSavings = (s.savingsAccounts || [])
        .filter(a => a.active !== false)
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
      const tAssetProceeds = (s.assets || [])
        .filter(a => a.includedInWhatIf)
        .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0)
      const tExpenses = [
        ...(s.expenses || []),
        ...(s.subscriptions || [])
          .filter(sub => sub.active !== false)
          .map(sub => ({ id: `sub_${sub.id}`, category: sub.name, monthlyAmount: sub.monthlyAmount, essential: false })),
        ...(s.creditCards || [])
          .filter(c => getEffectivePayment(c) > 0)
          .map(c => ({ id: `cc_${c.id}`, category: `${c.name} (payment)`, monthlyAmount: getEffectivePayment(c), essential: true })),
      ]
      const tWhatIf      = { ...DEFAULTS.whatIf, ...(s.whatIf || {}) }
      const tUnemployment = s.unemployment || DEFAULTS.unemployment
      const tInvestments  = [...(s.investments || []), ...(s.child1Investments || []), ...(s.child2Investments || [])]
      const tOneTime      = s.oneTimeExpenses || []
      const tOneTimeIncome = s.oneTimeIncome || []
      const tMonthlyIncome = s.monthlyIncome || []
      const tFurloughDate = s.furloughDate || DEFAULTS.furloughDate
      const tJobs = s.jobs || []
      const tOneTimePurchases = s.oneTimePurchases || []
      results[t.id] = computeBurndown(tSavings, tUnemployment, tExpenses, tWhatIf, tOneTime, tAssetProceeds, tInvestments, tOneTimeIncome, tMonthlyIncome, tFurloughDate, tJobs, tOneTimePurchases, s.creditCards || [])
    }
    return results
  }, [templates])

  // Pre-compute burndown results for each job scenario (for Job Scenarios tab)
  const jobScenarioResults = useMemo(() => {
    const baseWhatIfForScenarios = { ...whatIf, jobOfferSalary: 0, jobOfferStartDate: '' }
    const results = {}
    for (const scenario of jobScenarios) {
      const retirementPct = scenario.retirementContributionPct || 0
      const retirementAmount = (scenario.monthlyTakeHome * retirementPct) / 100
      const effectiveTakeHome = scenario.monthlyTakeHome - retirementAmount
      
      const scenarioWhatIf = {
        ...baseWhatIfForScenarios,
        jobOfferSalary: effectiveTakeHome,
        jobOfferStartDate: scenario.startDate,
        jobOfferAnnualRaisePct: scenario.annualRaisePct || 0,
        jobOfferSigningBonus: scenario.signingBonus || 0,
        jobOfferAnnualBonusPct: scenario.annualBonusPct || 0,
        jobOfferBenefitsOffset: scenario.employerBenefitsMonthly || 0,
        jobOfferEquityAnnual: scenario.equityAnnual || 0,
        jobOfferCommuteMonthly: scenario.commuteMonthly || 0,
        jobOfferGrossAnnual: scenario.grossAnnualSalary || 0,
        jobOfferTaxRatePct: scenario.taxRatePct || 0,
      }
      results[scenario.id] = computeBurndown(
        totalSavings, unemployment, expensesWithSubs, scenarioWhatIf,
        oneTimeExpenses, assetProceeds, investments, oneTimeIncome,
        monthlyIncome, furloughDate, [], oneTimePurchases, creditCards
      )
    }
    // Baseline (no job) result
    results['__baseline__'] = computeBurndown(
      totalSavings, unemployment, expensesWithSubs, baseWhatIfForScenarios,
      oneTimeExpenses, assetProceeds, investments, oneTimeIncome,
      monthlyIncome, furloughDate, [], oneTimePurchases, creditCards
    )
    return results
  }, [jobScenarios, totalSavings, unemployment, expensesWithSubs, whatIf, oneTimeExpenses, oneTimePurchases, assetProceeds, investments, oneTimeIncome, monthlyIncome, furloughDate])

  // Compute burndown for a historical snapshot so users can compare past projections
  const historicalBurndown = useMemo(() => {
    if (!historicalSnapshot || !historicalDate) return null
    const s = historicalSnapshot
    const hSavings = (s.savingsAccounts || [])
      .filter(a => a.active !== false)
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
    const hAssetProceeds = (s.assets || [])
      .filter(a => a.includedInWhatIf)
      .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0)
    const hExpenses = [
      ...(s.expenses || []),
      ...(s.subscriptions || [])
        .filter(sub => sub.active !== false)
        .map(sub => ({ id: `sub_${sub.id}`, category: sub.name, monthlyAmount: sub.monthlyAmount, essential: false })),
      ...(s.creditCards || [])
        .filter(c => getEffectivePayment(c) > 0)
        .map(c => ({ id: `cc_${c.id}`, category: `${c.name} (payment)`, monthlyAmount: getEffectivePayment(c), essential: true })),
    ]
    const hWhatIf      = { ...DEFAULTS.whatIf, ...(s.whatIf || {}) }
    const hUnemployment = s.unemployment || DEFAULTS.unemployment
    const hInvestments  = s.investments  || []
    const hOneTime      = s.oneTimeExpenses || []
    const hOneTimeIncome = s.oneTimeIncome || []
    const hMonthlyIncome = s.monthlyIncome || []
    const hJobs = s.jobs || []
    const hOneTimePurchases = s.oneTimePurchases || []
    return computeBurndown(
      hSavings, hUnemployment, hExpenses, hWhatIf,
      hOneTime, hAssetProceeds, hInvestments,
      hOneTimeIncome, hMonthlyIncome, historicalDate,
      hJobs, hOneTimePurchases, s.creditCards || []
    )
  }, [historicalSnapshot, historicalDate])

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

  return (
    <>
    {impersonating && <ImpersonationBanner user={user} onStop={stopImpersonating} />}
    <ToastProvider>
    <NotificationsProvider
      burndown={current}
      preferences={notificationPreferences}
      onPreferencesChange={setNotificationPreferences}
      initialBalance={totalSavings}
      budgetVariance={budgetVarianceData}
    >
    <CommentsProvider
      comments={comments}
      onCommentsChange={setComments}
      user={user}
    >
    <CommentsPanel />
    <NotificationPanel />
    <ToastContainer />
    <SkeletonStyles />
    <div className="min-h-screen theme-page" style={{ color: 'var(--text-primary)' }}>
      {/* Presentation overlay — rendered outside main layout so it fills the viewport */}
      {presentationMode && (
        <PresentationMode
          onClose={() => setPresentationMode(false)}
          current={current}
          base={base}
          totalSavings={totalSavings}
          assetProceeds={assetProceeds}
          hasWhatIf={hasWhatIf}
          expenses={expenses}
          subscriptions={subscriptions}
          investments={allInvestments}
          oneTimeExpenses={oneTimeExpenses}
          assets={assets}
          unemployment={unemployment}
          whatIf={whatIf}
        />
      )}

      {/* Activity log panel */}
      {logOpen && (
        <ActivityLogPanel
          entries={logEntries}
          onClose={() => setLogOpen(false)}
          onClear={clearLog}
          userName={userName}
          onSetUserName={setUserName}
        />
      )}

      {/* Household settings panel */}
      {orgOpen && (
        <OrgSettings user={user} onClose={() => setOrgOpen(false)} />
      )}

      <CommandPalette
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        goals={goals}
        jobScenarios={jobScenarios}
        templates={templates}
        savingsAccounts={savingsAccounts}
        creditCards={creditCards}
        people={people}
        expenses={expenses}
        subscriptions={subscriptions}
        investments={investments}
        isSuperAdmin={user?.isSuperAdmin}
      />

      <Header
        isSuperAdmin={user?.isSuperAdmin}
        rightSlot={
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCmdkOpen(true)}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Search (Ctrl+K)"
            >
              <Search size={18} strokeWidth={1.75} />
            </button>
            <CloudSaveStatus storage={s3Storage} />
            <NotificationBell />
            <TemplateManager
              templates={templates}
              activeTemplateId={activeTemplateId}
              onLoad={handleLoad}
              onSave={handleSave}
              onSaveNew={handleSaveNew}
              onRename={rename}
              onDelete={remove}
              onDuplicate={duplicate}
              onUpdateSnapshot={updateSnapshot}
            />
            <ProfileMenu
              user={user}
              onLogOpen={() => setLogOpen(true)}
              logCount={logEntries.length}
              onPresent={() => setPresentationMode(true)}
              onSignOut={logout}
              onHousehold={() => setOrgOpen(true)}
            />
          </div>
        }
      />

      {/* Global accounts sidebar — visible on all pages */}
      <AccountsSidebar
        creditCards={creditCards}
        savingsAccounts={savingsAccounts}
        statementIndex={statementIndex}
        selectedCardId={globalSelectedCardId}
        onSelectCard={setGlobalSelectedCardId}
        plaid={plaid}
        onSync={handleGlobalSync}
        people={people}
        user={user}
        onCreditCardsChange={onCreditCardsChange}
        onSavingsChange={onSavingsChange}
        onStatementsRefresh={refreshStatementIndex}
        loading={statementsLoading}
        error={statementsError}
        accountCustomizations={accountCustomizations}
        onAccountCustomizationsChange={setAccountCustomizations}
        collapsed={globalSidebarCollapsed}
        onCollapsedChange={setGlobalSidebarCollapsed}
        snapTrade={snapTrade}
      />

      {!dataReady ? <BurndownPageSkeleton /> :
      <div className={`${globalSidebarCollapsed ? 'xl:ml-[3.75rem]' : 'xl:ml-[17rem]'} transition-[margin] duration-200`}>
      <Routes>
        <Route path="/" element={
          <div className="xl:mr-[10rem]">
            <TableOfContents visibleSections={viewSettings.sections} />
            <div className="max-w-5xl mx-auto px-4 pt-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {people.length > 0 && (
                  <PersonFilter people={people} value={filterPersonId} onChange={setFilterPersonId} />
                )}
              </div>
              <ViewMenu value={viewSettings} onChange={setViewSettings} />
            </div>
            <ErrorBoundary level="component">
              <FinancialSidebar
                totalSavings={totalSavings}
                assetProceeds={assetProceeds}
                effectiveExpenses={current.effectiveExpenses}
                monthlyBenefits={current.monthlyBenefits}
                monthlyInvestments={current.monthlyInvestments}
                currentNetBurn={current.currentNetBurn}
                totalRunwayMonths={current.totalRunwayMonths}
                benefitEnd={current.benefitEnd}
                savingsAccounts={savingsAccounts}
                expenses={expenses}
                subscriptions={subscriptions}
                creditCards={creditCards}
                investments={allInvestments}
                oneTimeExpenses={oneTimeExpenses}
                oneTimeIncome={oneTimeIncome}
                monthlyIncome={monthlyIncome}
                unemployment={unemployment}
                jobs={jobs}
                people={people}
                filterPersonId={filterPersonId}
                advertisingRevenue={advertisingRevenue}
              />
            </ErrorBoundary>
            <ErrorBoundary level="section">
              <BurndownPage
                current={current}
                base={base}
                hasWhatIf={hasWhatIf}
                totalSavings={totalSavings}
                viewSettings={viewSettings}
                people={people}
                savingsAccounts={savingsAccounts}
                unemployment={unemployment}
                expenses={expenses}
                whatIf={whatIf}
                oneTimeExpenses={oneTimeExpenses}
                oneTimePurchases={oneTimePurchases}
                oneTimeIncome={oneTimeIncome}
                monthlyIncome={monthlyIncome}
                assets={assets}
                investments={investments}
                subscriptions={subscriptions}
                creditCards={creditCards}
                jobScenarios={jobScenarios}
                onSavingsChange={onSavingsChange}
                onUnemploymentChange={onUnemploymentChange}
                onFurloughChange={onFurloughChange}
                onExpensesChange={onExpensesChange}
                onWhatIfChange={onWhatIfChange}
                onOneTimeExpChange={onOneTimeExpChange}
                onOneTimePurchChange={onOneTimePurchChange}
                onOneTimeIncChange={onOneTimeIncChange}
                onMonthlyIncChange={onMonthlyIncChange}
                onAssetsChange={onAssetsChange}
                onInvestmentsChange={onInvestmentsChange}
                onSubsChange={onSubsChange}
                onCreditCardsChange={onCreditCardsChange}
                onJobScenariosChange={onJobScenariosChange}
                furloughDate={furloughDate}
                derivedStartDate={derivedStartDate}
                assetProceeds={assetProceeds}
                onWhatIfReset={() => {
                  const snap = activeTemplateId ? getSnapshot(activeTemplateId) : null
                  setWhatIf(snap?.whatIf ? { ...DEFAULTS.whatIf, ...snap.whatIf } : DEFAULTS.whatIf)
                }}
                templates={templates}
                templateResults={templateResults}
                jobScenarioResults={jobScenarioResults}
                plaid={plaid}
              snapTrade={snapTrade}
                filterPersonId={filterPersonId}
                onFilterPersonChange={setFilterPersonId}
                retirement={retirement}
                onRetirementChange={onRetirementChange}
                allTransactions={effectiveTransactions}
                transactionLinks={transactionLinks}
                txnToOverviewMap={txnToOverviewMap}
                onLinkTransaction={handleLinkTransaction}
                onUnlinkTransaction={handleUnlinkTransaction}
                transactionOverrides={transactionOverrides}
                properties={properties}
                homeImprovements={homeImprovements}
                onPropertiesChange={onPropertiesChange}
                onHomeImprovementsChange={onHomeImprovementsChange}
                advertisingRevenue={advertisingRevenue}
                onAdvertisingRevenueChange={onAdvertisingRevenueChange}
                snapshots={snapshots}
                historicalDate={historicalDate}
                historicalBurndown={historicalBurndown}
                onHistoricalDateSelect={handleHistoricalDateSelect}
              />
            </ErrorBoundary>
          </div>
        } />

        <Route path="/credit-cards" element={
          <CreditCardHubPage
            creditCards={creditCards}
            people={people}
            plaid={plaid}
            savingsAccounts={savingsAccounts}
            onCreditCardsChange={onCreditCardsChange}
            onSavingsChange={onSavingsChange}
            user={user}
            oneTimePurchases={oneTimePurchases}
            oneTimeExpenses={oneTimeExpenses}
            oneTimeIncome={oneTimeIncome}
            transactionLinks={transactionLinks}
            onLinkTransaction={handleLinkTransaction}
            onUnlinkTransaction={handleUnlinkTransaction}
            onAllTransactionsChange={setAllTransactionsCache}
            expenses={expenses}
            subscriptions={subscriptions}
            monthlyBenefits={current.monthlyBenefits}
            totalMonthlyIncome={current.totalMonthlyIncome}
            transactionOverrides={transactionOverrides}
            onTransactionOverride={handleTransactionOverride}
            jobs={jobs}
            accountCustomizations={accountCustomizations}
            onAccountCustomizationsChange={setAccountCustomizations}
            membersByUserId={membersByUserId}
            selectedCardId={globalSelectedCardId}
            onSelectCard={setGlobalSelectedCardId}
            statementIndex={statementIndex}
            onStatementsRefresh={refreshStatementIndex}
          />
        } />

        <Route path="/job-scenarios" element={
          <ErrorBoundary level="section">
            <JobScenariosPage
              jobScenarios={jobScenarios}
              onJobScenariosChange={onJobScenariosChange}
              jobScenarioResults={jobScenarioResults}
              totalSavings={totalSavings}
              effectiveExpenses={current.effectiveExpenses}
              monthlyBenefits={current.monthlyBenefits}
              monthlyInvestments={current.monthlyInvestments}
              currentNetBurn={current.currentNetBurn}
            />
          </ErrorBoundary>
        } />

        <Route path="/retirement" element={
          <RetirementPage
            retirement={retirement}
            onRetirementChange={onRetirementChange}
            people={people}
          />
        } />

        <Route path="/goals" element={
          <GoalsPage
            goals={goals}
            onGoalsChange={onGoalsChange}
            savingsAccounts={savingsAccounts}
            investments={investments}
            creditCards={creditCards}
            people={people}
          />
        } />

        <Route path="/net-worth" element={
          <NetWorthDashboardPage
            savingsAccounts={savingsAccounts}
            expenses={expenses}
            creditCards={creditCards}
            investments={investments}
            assets={assets}
            monthlyIncome={monthlyIncome}
            unemployment={unemployment}
            dataPoints={current.dataPoints}
            currentNetBurn={current.currentNetBurn}
            monthlyBenefits={current.monthlyBenefits}
            jobs={jobs}
          />
        } />

        <Route path="/analysis" element={
          <ErrorBoundary level="section">
            <ComparativeAnalysisPage
              dataPoints={current.dataPoints}
              baseDataPoints={base?.dataPoints}
              jobScenarios={jobScenarios}
              jobScenarioResults={jobScenarioResults}
              totalSavings={totalSavings}
              effectiveExpenses={current.effectiveExpenses}
              currentNetBurn={current.currentNetBurn}
              monthlyBenefits={current.monthlyBenefits}
            />
          </ErrorBoundary>
        } />

        <Route path="/budget" element={
          <BudgetPage
            categoryBudgets={categoryBudgets}
            onCategoryBudgetsChange={onCategoryBudgetsChange}
            allTransactions={effectiveTransactions}
            transactionOverrides={transactionOverrides}
          />
        } />

        <Route path="/settings" element={
          <UserProfilePage
            user={user}
            updateProfile={updateProfile}
            jobs={jobs}
            onJobsChange={onJobsChange}
            people={people}
            allTransactions={effectiveTransactions}
            transactionOverrides={transactionOverrides}
            properties={properties}
            onPropertiesChange={onPropertiesChange}
            exportData={{
              burndown: current,
              expenses,
              savingsAccounts,
              scenarios: jobScenarios,
              scenarioResults: jobScenarioResults,
              totalSavings,
              unemployment,
              creditCards,
              monthlyIncome,
              investments,
              transactions: effectiveTransactions,
            }}
          />
        } />
        {user?.isSuperAdmin && (
          <>
            <Route path="/admin" element={<SuperAdminPage />} />
            <Route path="/admin/tools" element={<SuperAdminToolsPage />} />
          </>
        )}

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </div>}
    </div>
    </CommentsProvider>
    </NotificationsProvider>
    </ToastProvider>
    </>
  )
}
