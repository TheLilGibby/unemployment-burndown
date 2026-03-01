import { useState, useMemo, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom'
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
import PeopleMenu from './components/people/PeopleMenu'
import PresentationMode from './components/presentation/PresentationMode'
import ThemeToggle from './components/layout/ThemeToggle'
import TableOfContents from './components/layout/TableOfContents'
import ViewMenu from './components/layout/ViewMenu'
import CloudSaveStatus from './components/layout/CloudSaveStatus'
import ActivityLogPanel from './components/layout/ActivityLogPanel'
import FinancialSidebar from './components/layout/FinancialSidebar'
import BurndownPage from './pages/BurndownPage'
import CreditCardHubPage from './pages/CreditCardHubPage'
import JobScenariosPage from './components/scenarios/JobScenariosPage'
import UserProfilePage from './pages/UserProfilePage'
import { useS3Storage } from './hooks/useS3Storage'
import { usePlaid } from './hooks/usePlaid'
import { diffArray, diffObject, diffPrimitive } from './utils/diffSection'
import { CommentsProvider } from './context/CommentsContext'
import CommentsPanel from './components/comments/CommentsPanel'
import PlaidLinkButton from './components/plaid/PlaidLinkButton'
import ConnectedAccountsPanel from './components/plaid/ConnectedAccountsPanel'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import MfaSetup from './components/auth/MfaSetup'
import OrgSetup from './components/auth/OrgSetup'
import OrgSettings from './components/org/OrgSettings'
import { NotificationsProvider } from './context/NotificationsContext'
import NotificationBell from './components/notifications/NotificationBell'
import NotificationPanel from './components/notifications/NotificationPanel'
import ToastContainer from './components/notifications/ToastContainer'
import ErrorBoundary from './components/common/ErrorBoundary'

// Migrate old job scenario shape to enhanced model (backward compat)
function migrateJobScenario(s) {
  if (s.grossAnnualSalary != null) return s
  return {
    ...s,
    grossAnnualSalary: (s.monthlyTakeHome || 0) * 12,
    usState: '',
    taxRatePct: 0,
    savingsAllocation: 0,
    savingsAllocationType: 'dollar',
    investmentAllocation: 0,
    investmentAllocationType: 'dollar',
  }
}

// ---------------------------------------------------------------------------
// Pure burndown computation (mirrors useBurndown logic without React hooks).
// Used inside useMemo to compute template results for the Compare tab.
// ---------------------------------------------------------------------------
function computeBurndown(savings, unemployment, expenses, whatIf, oneTimeExpenses, extraCash, investments, oneTimeIncome = [], monthlyIncome = [], startDate = null, jobs = []) {
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

  const oneTimeIncomeByMonth = {}
  for (const oti of (oneTimeIncome || [])) {
    if (!oti.date || !oti.amount) continue
    const otiDate = dayjs(oti.date)
    if (otiDate.isBefore(today)) continue
    const slot = Math.max(1, otiDate.diff(today, 'month') + 1)
    oneTimeIncomeByMonth[slot] = (oneTimeIncomeByMonth[slot] || 0) + (Number(oti.amount) || 0)
  }

  const MAX_MONTHS = 120
  let balance = (Number(savings) || 0) + (Number(extraCash) || 0)
  const dataPoints = [{
    date: today.toDate(), dateLabel: today.format('MMM YYYY'),
    balance: Math.round(Math.max(0, balance - emergencyFloor)),
    rawBalance: Math.round(balance), month: 0,
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
      if (jobAnnualRaisePct > 0 && jobStartDate) {
        const monthsSinceStart = currentDate.diff(jobStartDate, 'month')
        const fullYears = Math.floor(monthsSinceStart / 12)
        income += fullYears > 0 ? jobSalary * Math.pow(1 + jobAnnualRaisePct / 100, fullYears) : jobSalary
      } else {
        income += jobSalary
      }
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
    const monthExpenses = (essentialTotal + nonEssentialTotal * expReductionFactor) * raiseFactor
    const oneTimeCost = oneTimeByMonth[i] || 0
    const oneTimeIncomeThisMonth = oneTimeIncomeByMonth[i] || 0
    const netBurn = monthExpenses + monthlyInvestments - income + oneTimeCost - oneTimeIncomeThisMonth
    const prevBalance = balance
    balance = balance - netBurn
    const effectiveBalance = balance - emergencyFloor
    const prevEffective = prevBalance - emergencyFloor
    if (effectiveBalance <= 0 && runoutDate === null) {
      const safeDenom = netBurn === 0 ? 1 : netBurn
      const fraction = Math.min(1, Math.max(0, prevEffective / safeDenom))
      const crossoverDate = today.add(i - 1 + fraction, 'month')
      runoutDate = crossoverDate.toDate()
      runoutMonth = i - 1 + fraction
    }
    dataPoints.push({
      date: currentDate.toDate(), dateLabel: currentDate.format('MMM YYYY'),
      balance: Math.max(0, Math.round(effectiveBalance)),
      rawBalance: Math.round(balance), month: i,
      oneTimeCost: oneTimeCost > 0 ? Math.round(oneTimeCost) : undefined,
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
  }
  if (currentJobIncome === 0 && !jobOfferActiveNow) currentIncome += sideIncome
  const currentNetBurn = effectiveExpenses + monthlyInvestments - currentIncome

  return {
    dataPoints, runoutDate, totalRunwayMonths: runoutMonth,
    currentNetBurn, effectiveExpenses, monthlyBenefits, monthlyInvestments,
    benefitEnd: benefitEnd.toDate(),
  }
}

// ---------------------------------------------------------------------------

const DEFAULT_VIEW = {
  chartLines: { allExpenses: true, essentialsOnly: true, baseline: true },
  sections: {
    jobs:          true,
    whatif:        true,
    subscriptions: true,
    creditCards:   true,
    investments:   true,
    onetimes:      true,
    onetimeIncome:   true,
    monthlyIncome:   true,
    assets:          true,
    plaidAccounts:   true,
    retirement:      true,
  },
}

function HeaderOverflow({ onLogOpen, logCount, onPresent, onSignOut, onSecurity, onHousehold }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
        style={{ color: 'var(--text-muted)' }}
        title="More options"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border shadow-2xl z-50 py-1 overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <button
            onClick={() => { onLogOpen(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
            <span className="flex-1 text-left">Activity Log</span>
            {logCount > 0 && (
              <span
                className="text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center"
                style={{ background: 'var(--accent-blue)', color: '#fff', lineHeight: '16px' }}
              >
                {logCount > 99 ? '99+' : logCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { onPresent(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span className="flex-1 text-left">Present</span>
          </button>

          <button
            onClick={() => { onSecurity(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="flex-1 text-left">Security</span>
          </button>

          <button
            onClick={() => { onHousehold(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="flex-1 text-left">Household</span>
          </button>

          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="flex-1 text-left">Profile</span>
          </Link>

          <div className="my-1" style={{ borderTop: '1px solid var(--border-subtle)' }} />

          <button
            onClick={() => { onSignOut(); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="flex-1 text-left">Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const { authed, user, error: authError, loading, mfaPending, hasOrg, login, verifyMfa, register, logout, cancelMfa, createOrg, joinOrg } = useAuth()
  const location = useLocation()

  // Privacy policy is accessible without authentication
  if (location.pathname === '/privacy') return <PrivacyPolicyPage />

  // Show loading state while checking token
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
    </div>
  )

  if (!authed) return (
    <LoginScreen
      onLogin={login}
      onRegister={register}
      onVerifyMfa={verifyMfa}
      onCancelMfa={cancelMfa}
      mfaPending={mfaPending}
      error={authError}
    />
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

  return <AuthenticatedApp logout={logout} user={user} />
}

function AuthenticatedApp({ logout, user }) {
  const [presentationMode, setPresentationMode] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [orgOpen, setOrgOpen] = useState(false)
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled || false)
  const [viewSettings, setViewSettings] = useState(DEFAULT_VIEW)
  const [furloughDate, setFurloughDate] = useState(DEFAULTS.furloughDate)
  const [people, setPeople] = useState(DEFAULTS.people)
  const [savingsAccounts, setSavingsAccounts] = useState(DEFAULTS.savingsAccounts)
  const [unemployment, setUnemployment] = useState(DEFAULTS.unemployment)
  const [expenses, setExpenses] = useState(DEFAULTS.expenses)
  const [whatIf, setWhatIf] = useState(DEFAULTS.whatIf)
  const [oneTimeExpenses, setOneTimeExpenses] = useState(DEFAULTS.oneTimeExpenses)
  const [assets, setAssets] = useState(DEFAULTS.assets)
  const [investments, setInvestments] = useState(DEFAULTS.investments)
  const [subscriptions, setSubscriptions] = useState(DEFAULTS.subscriptions)
  const [creditCards, setCreditCards] = useState(DEFAULTS.creditCards)
  const [oneTimeIncome, setOneTimeIncome] = useState(DEFAULTS.oneTimeIncome)
  const [monthlyIncome, setMonthlyIncome] = useState(DEFAULTS.monthlyIncome)
  const [jobs, setJobs] = useState(DEFAULTS.jobs)
  const [jobScenarios, setJobScenarios] = useState(DEFAULTS.jobScenarios)
  const [retirement, setRetirement] = useState(DEFAULTS.retirement)
  const [comments, setComments] = useState({})
  const [defaultPersonId, setDefaultPersonId] = useState(null)
  const [filterPersonId, setFilterPersonId] = useState(null)
  const [notificationPreferences, setNotificationPreferences] = useState(DEFAULTS.notificationPreferences)

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

  const { entries: logEntries, addEntry, clearLog, loadEntries, userName, setUserName } = useActivityLog()
  const dirtySections = useRef(new Set())

  const s3Storage = useS3Storage()

  // Plaid integration — auto-updates savings & credit card balances from bank data
  const handlePlaidSync = (updatedFullState) => {
    if (updatedFullState) {
      applyFullState(updatedFullState)
      addEntry('sync', 'Plaid sync: balances updated from bank')
    }
  }
  const plaid = usePlaid({ onSyncComplete: handlePlaidSync })

  function buildSnapshot() {
    return { furloughDate, people, savingsAccounts, unemployment, expenses, whatIf, oneTimeExpenses, oneTimeIncome, monthlyIncome, jobs, assets, investments, subscriptions, creditCards, jobScenarios, retirement }
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
    if (snapshot.oneTimeIncome) setOneTimeIncome(snapshot.oneTimeIncome)
    if (snapshot.monthlyIncome) setMonthlyIncome(snapshot.monthlyIncome)
    if (snapshot.jobs) setJobs(snapshot.jobs)
    if (snapshot.assets) setAssets(snapshot.assets)
    if (snapshot.investments) setInvestments(snapshot.investments)
    if (snapshot.subscriptions) setSubscriptions(snapshot.subscriptions)
    if (snapshot.creditCards) setCreditCards(snapshot.creditCards)
    if (snapshot.jobScenarios) setJobScenarios(snapshot.jobScenarios.map(migrateJobScenario))
    if (snapshot.retirement) setRetirement({ ...DEFAULTS.retirement, ...snapshot.retirement })
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
      defaultPersonId,
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
    if (data.defaultPersonId != null) setDefaultPersonId(data.defaultPersonId)
    if (Array.isArray(data.activityLog)) loadEntries(data.activityLog)
    if (data.notificationPreferences) setNotificationPreferences({ ...DEFAULTS.notificationPreferences, ...data.notificationPreferences })
  }

  // When S3 storage loads data on mount, apply it
  useEffect(() => {
    if (s3Storage.restoreData) {
      applyFullState(s3Storage.restoreData)
      s3Storage.clearRestoreData()
      addEntry('load', 'Data loaded from cloud')
    }
  }, [s3Storage.restoreData]) // eslint-disable-line

  // Auto-save to S3 on every state change (debounced 1.5 s)
  const autoSaveTimer = useRef(null)
  useEffect(() => {
    if (s3Storage.status === 'loading') return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      s3Storage.save(buildFullState())
      if (dirtySections.current.size > 0) {
        addEntry('save', `Auto-saved: ${[...dirtySections.current].join(', ')}`)
        dirtySections.current.clear()
      }
    }, 1500)
    return () => clearTimeout(autoSaveTimer.current)
  }, [furloughDate, people, savingsAccounts, unemployment, expenses, whatIf, oneTimeExpenses, oneTimeIncome, monthlyIncome, jobs, assets, investments, subscriptions, creditCards, jobScenarios, retirement, templates, comments, defaultPersonId, notificationPreferences]) // eslint-disable-line

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
  const summarizeCCs          = (v) => _allSum(v, 'minimumPayment') + ' min/mo'
  const summarizeJobScenarios = (v) => `${v.length} scenario${v.length !== 1 ? 's' : ''}`
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
  const onOneTimeIncChange   = track(() => oneTimeIncome,   setOneTimeIncome,   'One-time income',    summarizeOneTimeInc,   diffArray)
  const onMonthlyIncChange   = track(() => monthlyIncome,   setMonthlyIncome,   'Monthly income',     summarizeMonthlyInc,   diffArray)
  const onJobsChange         = track(() => jobs,            setJobs,            'Jobs',               summarizeJobs,         diffArray)
  const onAssetsChange       = track(() => assets,          setAssets,          'Assets',             summarizeAssets,       diffArray)
  const onInvestmentsChange  = track(() => investments,     setInvestments,     'Investments',        summarizeInvestments,  diffArray)
  const onSubsChange         = track(() => subscriptions,   setSubscriptions,   'Subscriptions',      summarizeSubs,         diffArray)
  const onCreditCardsChange  = track(() => creditCards,     setCreditCards,     'Credit cards',       summarizeCCs,          diffArray)
  const onJobScenariosChange = track(() => jobScenarios,    setJobScenarios,    'Job scenarios',      summarizeJobScenarios, diffArray)
  const onRetirementChange   = track(() => retirement,      setRetirement,      'Retirement plan',    summarizeRetirement,   diffObject)

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

  // Merge active subscriptions + credit card minimum payments into expenses
  const expensesWithSubs = [
    ...expenses,
    ...subscriptions
      .filter(s => s.active !== false)
      .map(s => ({ id: `sub_${s.id}`, category: s.name, monthlyAmount: s.monthlyAmount, essential: false })),
    ...creditCards
      .filter(c => (Number(c.minimumPayment) || 0) > 0)
      .map(c => ({ id: `cc_${c.id}`, category: `${c.name} (min. payment)`, monthlyAmount: c.minimumPayment, essential: true })),
  ]

  // Base calculation (no what-if, no asset sales) — used for delta display
  const baseWhatIf = { ...DEFAULTS.whatIf }
  const base = useBurndown(totalSavings, unemployment, expensesWithSubs, baseWhatIf, oneTimeExpenses, 0, investments, oneTimeIncome, monthlyIncome, effectiveStartDate, jobs)

  // With all what-if scenarios applied
  const current = useBurndown(totalSavings, unemployment, expensesWithSubs, whatIf, oneTimeExpenses, assetProceeds, investments, oneTimeIncome, monthlyIncome, effectiveStartDate, jobs)

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
          .filter(c => (Number(c.minimumPayment) || 0) > 0)
          .map(c => ({ id: `cc_${c.id}`, category: `${c.name} (min. payment)`, monthlyAmount: c.minimumPayment, essential: true })),
      ]
      const tWhatIf      = { ...DEFAULTS.whatIf, ...(s.whatIf || {}) }
      const tUnemployment = s.unemployment || DEFAULTS.unemployment
      const tInvestments  = s.investments  || []
      const tOneTime      = s.oneTimeExpenses || []
      const tOneTimeIncome = s.oneTimeIncome || []
      const tMonthlyIncome = s.monthlyIncome || []
      const tFurloughDate = s.furloughDate || DEFAULTS.furloughDate
      const tJobs = s.jobs || []
      results[t.id] = computeBurndown(tSavings, tUnemployment, tExpenses, tWhatIf, tOneTime, tAssetProceeds, tInvestments, tOneTimeIncome, tMonthlyIncome, tFurloughDate, tJobs)
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
      }
      results[scenario.id] = computeBurndown(
        totalSavings, unemployment, expensesWithSubs, scenarioWhatIf,
        oneTimeExpenses, assetProceeds, investments, oneTimeIncome,
        monthlyIncome, furloughDate
      )
    }
    // Baseline (no job) result
    results['__baseline__'] = computeBurndown(
      totalSavings, unemployment, expensesWithSubs, baseWhatIfForScenarios,
      oneTimeExpenses, assetProceeds, investments, oneTimeIncome,
      monthlyIncome, furloughDate
    )
    return results
  }, [jobScenarios, totalSavings, unemployment, expensesWithSubs, whatIf, oneTimeExpenses, assetProceeds, investments, oneTimeIncome, monthlyIncome, furloughDate])

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

  return (
    <NotificationsProvider
      burndown={current}
      preferences={notificationPreferences}
      onPreferencesChange={setNotificationPreferences}
      initialBalance={totalSavings}
    >
    <CommentsProvider
      comments={comments}
      onCommentsChange={setComments}
      people={people}
      defaultPersonId={defaultPersonId}
      onDefaultPersonChange={setDefaultPersonId}
    >
    <CommentsPanel />
    <NotificationPanel />
    <ToastContainer />
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
          investments={investments}
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

      {/* Security settings panel */}
      {securityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Security Settings</h2>
              <button
                onClick={() => setSecurityOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                style={{ color: 'var(--text-muted)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Signed in as <strong style={{ color: 'var(--text-primary)' }}>{user?.email}</strong>
              </div>
              <MfaSetup mfaEnabled={mfaEnabled} onMfaChange={setMfaEnabled} />
            </div>
          </div>
        </div>
      )}

      {/* Household settings panel */}
      {orgOpen && (
        <OrgSettings user={user} onClose={() => setOrgOpen(false)} />
      )}

      <Header
        rightSlot={
          <div className="flex items-center gap-0.5">
            <CloudSaveStatus storage={s3Storage} />
            {import.meta.env.VITE_PLAID_API_URL && (
              <PlaidLinkButton
                createLinkToken={plaid.createLinkToken}
                exchangeToken={plaid.exchangeToken}
                syncAll={plaid.syncAll}
                linkedCount={plaid.linkedItems.length}
                syncing={plaid.syncing}
              />
            )}
            {/* Activity log button */}
            <button
              onClick={() => setLogOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
              title="View activity log"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-input)',
                color: 'var(--text-muted)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Log</span>
              {logEntries.length > 0 && (
                <span
                  className="text-xs font-semibold px-1 rounded-full tabular-nums"
                  style={{ background: 'var(--accent-blue)', color: '#fff', fontSize: '10px', lineHeight: '16px', minWidth: 16, textAlign: 'center' }}
                >
                  {logEntries.length > 99 ? '99+' : logEntries.length}
                </span>
              )}
            </button>
            <NotificationBell />
            <PeopleMenu people={people} onChange={onPeopleChange} />
            <ThemeToggle />
            <ViewMenu value={viewSettings} onChange={setViewSettings} />
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
            <HeaderOverflow
              onLogOpen={() => setLogOpen(true)}
              logCount={logEntries.length}
              onPresent={() => setPresentationMode(true)}
              onSignOut={logout}
              onSecurity={() => setSecurityOpen(true)}
              onHousehold={() => setOrgOpen(true)}
            />
          </div>
        }
      />

      <Routes>
        <Route path="/" element={
          <>
            <TableOfContents visibleSections={viewSettings.sections} />
            {people.length > 0 && (
              <div className="max-w-5xl mx-auto px-4 pt-4">
                <PersonFilter people={people} value={filterPersonId} onChange={setFilterPersonId} />
              </div>
            )}
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
                investments={investments}
                oneTimeExpenses={oneTimeExpenses}
                oneTimeIncome={oneTimeIncome}
                monthlyIncome={monthlyIncome}
                unemployment={unemployment}
                jobs={jobs}
                people={people}
                filterPersonId={filterPersonId}
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
                oneTimeIncome={oneTimeIncome}
                monthlyIncome={monthlyIncome}
                assets={assets}
                investments={investments}
                subscriptions={subscriptions}
                creditCards={creditCards}
                jobs={jobs}
                jobScenarios={jobScenarios}
                onJobsChange={onJobsChange}
                onSavingsChange={onSavingsChange}
                onUnemploymentChange={onUnemploymentChange}
                onFurloughChange={onFurloughChange}
                onExpensesChange={onExpensesChange}
                onWhatIfChange={onWhatIfChange}
                onOneTimeExpChange={onOneTimeExpChange}
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
                filterPersonId={filterPersonId}
                onFilterPersonChange={setFilterPersonId}
                retirement={retirement}
                onRetirementChange={onRetirementChange}
              />
            </ErrorBoundary>
          </>
        } />

        <Route path="/credit-cards" element={
          <CreditCardHubPage creditCards={creditCards} people={people} plaid={plaid} savingsAccounts={savingsAccounts} />
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

        <Route path="/profile" element={<UserProfilePage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
    </CommentsProvider>
    </NotificationsProvider>
  )
}
