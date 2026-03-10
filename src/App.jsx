import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'
import { DEFAULTS } from './constants/defaults'
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
const CreditCardHubPage = lazy(() => import('./pages/CreditCardHubPage'))
const JobScenariosPage = lazy(() => import('./components/scenarios/JobScenariosPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const RetirementPage = lazy(() => import('./pages/RetirementPage'))
const GoalsPage = lazy(() => import('./pages/GoalsPage'))
const ComparativeAnalysisPage = lazy(() => import('./pages/ComparativeAnalysisPage'))
const BudgetPage = lazy(() => import('./pages/BudgetPage'))
const NetWorthDashboardPage = lazy(() => import('./pages/NetWorthDashboardPage'))
import AccountsSidebar from './components/statements/AccountsSidebar'
import { CommentsProvider } from './context/CommentsContext'
import { TierProvider } from './context/TierContext'
import CommentsPanel from './components/comments/CommentsPanel'
import ConnectedAccountsPanel from './components/plaid/ConnectedAccountsPanel'
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const SuperAdminToolsPage = lazy(() => import('./pages/SuperAdminToolsPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
import OrgSetup from './components/auth/OrgSetup'
import AcceptInvite from './components/auth/AcceptInvite'
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
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
import { FinancialDataProvider, useFinancialData } from './context/FinancialDataContext'

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
  if (location.pathname === '/privacy') return <Suspense fallback={<AppLoadingSkeleton />}><PrivacyPolicyPage /></Suspense>
  if (location.pathname === '/reset-password') return <Suspense fallback={<AppLoadingSkeleton />}><ResetPasswordPage /></Suspense>
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

  return (
    <FinancialDataProvider user={user}>
      <AuthenticatedApp logout={logout} user={user} updateProfile={updateProfile} impersonating={impersonating} stopImpersonating={stopImpersonating} />
    </FinancialDataProvider>
  )
}

function AuthenticatedApp({ logout, user, updateProfile, impersonating, stopImpersonating }) {
  const [presentationMode, setPresentationMode] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [orgOpen, setOrgOpen] = useState(false)
  const [viewSettings, setViewSettings] = useState(DEFAULT_VIEW)
  const [globalSelectedCardId, setGlobalSelectedCardId] = useState(null)
  const [globalSidebarCollapsed, setGlobalSidebarCollapsed] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)

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

  // Pull everything from FinancialDataContext
  const fd = useFinancialData()

  return (
    <>
    {impersonating && <ImpersonationBanner user={user} onStop={stopImpersonating} />}
    <ToastProvider>
    <NotificationsProvider
      burndown={fd.current}
      preferences={fd.notificationPreferences}
      onPreferencesChange={fd.setNotificationPreferences}
      initialBalance={fd.totalSavings}
      budgetVariance={fd.budgetVarianceData}
    >
    <CommentsProvider
      comments={fd.comments}
      onCommentsChange={fd.setComments}
      user={user}
    >
    <TierProvider user={user}>
    <CommentsPanel />
    <NotificationPanel />
    <ToastContainer />
    <SkeletonStyles />
    <div className="min-h-screen theme-page" style={{ color: 'var(--text-primary)' }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-white focus:text-blue-600 focus:underline"
      >
        Skip to main content
      </a>
      {/* Presentation overlay */}
      {presentationMode && (
        <PresentationMode
          onClose={() => setPresentationMode(false)}
          current={fd.current}
          base={fd.base}
          totalSavings={fd.totalSavings}
          assetProceeds={fd.assetProceeds}
          hasWhatIf={fd.hasWhatIf}
          expenses={fd.expenses}
          subscriptions={fd.subscriptions}
          investments={fd.allInvestments}
          oneTimeExpenses={fd.oneTimeExpenses}
          assets={fd.assets}
          unemployment={fd.unemployment}
          whatIf={fd.whatIf}
        />
      )}

      {/* Activity log panel */}
      {logOpen && (
        <ActivityLogPanel
          entries={fd.logEntries}
          onClose={() => setLogOpen(false)}
          onClear={fd.clearLog}
          userName={fd.userName}
          onSetUserName={fd.setUserName}
        />
      )}

      {/* Household settings panel */}
      {orgOpen && (
        <OrgSettings user={user} onClose={() => setOrgOpen(false)} />
      )}

      <CommandPalette
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        goals={fd.goals}
        jobScenarios={fd.jobScenarios}
        templates={fd.templates}
        savingsAccounts={fd.savingsAccounts}
        creditCards={fd.creditCards}
        people={fd.people}
        expenses={fd.expenses}
        subscriptions={fd.subscriptions}
        investments={fd.investments}
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
            <CloudSaveStatus storage={fd.s3Storage} />
            <NotificationBell />
            <TemplateManager
              templates={fd.templates}
              activeTemplateId={fd.activeTemplateId}
              onLoad={fd.handleLoad}
              onSave={fd.handleSave}
              onSaveNew={fd.handleSaveNew}
              onRename={fd.rename}
              onDelete={fd.remove}
              onDuplicate={fd.duplicate}
              onUpdateSnapshot={fd.updateSnapshot}
            />
            <ProfileMenu
              user={user}
              onLogOpen={() => setLogOpen(true)}
              logCount={fd.logEntries.length}
              onPresent={() => setPresentationMode(true)}
              onSignOut={logout}
              onHousehold={() => setOrgOpen(true)}
            />
          </div>
        }
      />

      {/* Global accounts sidebar */}
      <AccountsSidebar
        creditCards={fd.creditCards}
        savingsAccounts={fd.savingsAccounts}
        statementIndex={fd.statementIndex}
        selectedCardId={globalSelectedCardId}
        onSelectCard={setGlobalSelectedCardId}
        plaid={fd.tierGatedPlaid}
        onSync={fd.handleGlobalSync}
        people={fd.people}
        user={user}
        onCreditCardsChange={fd.onCreditCardsChange}
        onSavingsChange={fd.onSavingsChange}
        onStatementsRefresh={fd.refreshStatementIndex}
        loading={fd.statementsLoading}
        error={fd.statementsError}
        accountCustomizations={fd.accountCustomizations}
        onAccountCustomizationsChange={fd.setAccountCustomizations}
        collapsed={globalSidebarCollapsed}
        onCollapsedChange={setGlobalSidebarCollapsed}
        snapTrade={fd.tierGatedSnapTrade}
      />

      {!fd.dataReady ? <BurndownPageSkeleton /> :
      <div id="main-content" className={`${globalSidebarCollapsed ? 'xl:ml-[3.75rem]' : 'xl:ml-[17rem]'} transition-[margin] duration-200`}>
      <Suspense fallback={<AppLoadingSkeleton />}>
      <Routes>
        <Route path="/" element={
          <div className="xl:mr-[10rem]">
            <TableOfContents visibleSections={viewSettings.sections} />
            <div className="max-w-5xl mx-auto px-4 pt-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                {fd.people.length > 0 && (
                  <PersonFilter people={fd.people} value={fd.filterPersonId} onChange={fd.setFilterPersonId} />
                )}
              </div>
              <ViewMenu value={viewSettings} onChange={setViewSettings} />
            </div>
            <ErrorBoundary level="component">
              <FinancialSidebar
                totalSavings={fd.totalSavings}
                assetProceeds={fd.assetProceeds}
                effectiveExpenses={fd.current.effectiveExpenses}
                monthlyBenefits={fd.current.monthlyBenefits}
                monthlyInvestments={fd.current.monthlyInvestments}
                currentNetBurn={fd.current.currentNetBurn}
                totalRunwayMonths={fd.current.totalRunwayMonths}
                benefitEnd={fd.current.benefitEnd}
                savingsAccounts={fd.savingsAccounts}
                expenses={fd.expenses}
                subscriptions={fd.subscriptions}
                creditCards={fd.creditCards}
                investments={fd.allInvestments}
                oneTimeExpenses={fd.oneTimeExpenses}
                oneTimeIncome={fd.oneTimeIncome}
                monthlyIncome={fd.monthlyIncome}
                unemployment={fd.unemployment}
                jobs={fd.jobs}
                people={fd.people}
                filterPersonId={fd.filterPersonId}
                advertisingRevenue={fd.advertisingRevenue}
              />
            </ErrorBoundary>
            <ErrorBoundary level="section">
              <BurndownPage
                current={fd.current}
                base={fd.base}
                hasWhatIf={fd.hasWhatIf}
                totalSavings={fd.totalSavings}
                viewSettings={viewSettings}
                people={fd.people}
                savingsAccounts={fd.savingsAccounts}
                unemployment={fd.unemployment}
                expenses={fd.expenses}
                whatIf={fd.whatIf}
                oneTimeExpenses={fd.oneTimeExpenses}
                oneTimePurchases={fd.oneTimePurchases}
                oneTimeIncome={fd.oneTimeIncome}
                monthlyIncome={fd.monthlyIncome}
                assets={fd.assets}
                investments={fd.investments}
                subscriptions={fd.subscriptions}
                creditCards={fd.creditCards}
                jobScenarios={fd.jobScenarios}
                onSavingsChange={fd.onSavingsChange}
                onUnemploymentChange={fd.onUnemploymentChange}
                onFurloughChange={fd.onFurloughChange}
                onExpensesChange={fd.onExpensesChange}
                onWhatIfChange={fd.onWhatIfChange}
                onOneTimeExpChange={fd.onOneTimeExpChange}
                onOneTimePurchChange={fd.onOneTimePurchChange}
                onOneTimeIncChange={fd.onOneTimeIncChange}
                onMonthlyIncChange={fd.onMonthlyIncChange}
                onAssetsChange={fd.onAssetsChange}
                onInvestmentsChange={fd.onInvestmentsChange}
                onSubsChange={fd.onSubsChange}
                onCreditCardsChange={fd.onCreditCardsChange}
                onJobScenariosChange={fd.onJobScenariosChange}
                furloughDate={fd.furloughDate}
                derivedStartDate={fd.derivedStartDate}
                assetProceeds={fd.assetProceeds}
                onWhatIfReset={fd.onWhatIfReset}
                templates={fd.templates}
                templateResults={fd.templateResults}
                jobScenarioResults={fd.jobScenarioResults}
                plaid={fd.tierGatedPlaid}
              snapTrade={fd.tierGatedSnapTrade}
                filterPersonId={fd.filterPersonId}
                onFilterPersonChange={fd.setFilterPersonId}
                retirement={fd.retirement}
                onRetirementChange={fd.onRetirementChange}
                allTransactions={fd.effectiveTransactions}
                transactionLinks={fd.transactionLinks}
                txnToOverviewMap={fd.txnToOverviewMap}
                onLinkTransaction={fd.handleLinkTransaction}
                onUnlinkTransaction={fd.handleUnlinkTransaction}
                transactionOverrides={fd.transactionOverrides}
                properties={fd.properties}
                homeImprovements={fd.homeImprovements}
                onPropertiesChange={fd.onPropertiesChange}
                onHomeImprovementsChange={fd.onHomeImprovementsChange}
                advertisingRevenue={fd.advertisingRevenue}
                onAdvertisingRevenueChange={fd.onAdvertisingRevenueChange}
                snapshots={fd.snapshots}
                historicalDate={fd.historicalDate}
                historicalBurndown={fd.historicalBurndown}
                onHistoricalDateSelect={fd.handleHistoricalDateSelect}
              />
            </ErrorBoundary>
          </div>
        } />

        <Route path="/credit-cards" element={
          <ErrorBoundary level="section">
          <CreditCardHubPage
            creditCards={fd.creditCards}
            people={fd.people}
            plaid={fd.tierGatedPlaid}
            savingsAccounts={fd.savingsAccounts}
            onCreditCardsChange={fd.onCreditCardsChange}
            onSavingsChange={fd.onSavingsChange}
            user={user}
            oneTimePurchases={fd.oneTimePurchases}
            oneTimeExpenses={fd.oneTimeExpenses}
            oneTimeIncome={fd.oneTimeIncome}
            transactionLinks={fd.transactionLinks}
            onLinkTransaction={fd.handleLinkTransaction}
            onUnlinkTransaction={fd.handleUnlinkTransaction}
            onAllTransactionsChange={fd.setAllTransactionsCache}
            expenses={fd.expenses}
            subscriptions={fd.subscriptions}
            monthlyBenefits={fd.current.monthlyBenefits}
            totalMonthlyIncome={fd.current.totalMonthlyIncome}
            transactionOverrides={fd.transactionOverrides}
            onTransactionOverride={fd.handleTransactionOverride}
            jobs={fd.jobs}
            accountCustomizations={fd.accountCustomizations}
            onAccountCustomizationsChange={fd.setAccountCustomizations}
            membersByUserId={fd.membersByUserId}
            selectedCardId={globalSelectedCardId}
            onSelectCard={setGlobalSelectedCardId}
            statementIndex={fd.statementIndex}
            onStatementsRefresh={fd.refreshStatementIndex}
          />
          </ErrorBoundary>
        } />

        <Route path="/job-scenarios" element={
          <ErrorBoundary level="section">
            <JobScenariosPage
              jobScenarios={fd.jobScenarios}
              onJobScenariosChange={fd.onJobScenariosChange}
              jobScenarioResults={fd.jobScenarioResults}
              totalSavings={fd.totalSavings}
              effectiveExpenses={fd.current.effectiveExpenses}
              monthlyBenefits={fd.current.monthlyBenefits}
              monthlyInvestments={fd.current.monthlyInvestments}
              currentNetBurn={fd.current.currentNetBurn}
            />
          </ErrorBoundary>
        } />

        <Route path="/retirement" element={
          <ErrorBoundary level="section">
            <RetirementPage
              retirement={fd.retirement}
              onRetirementChange={fd.onRetirementChange}
              people={fd.people}
            />
          </ErrorBoundary>
        } />

        <Route path="/goals" element={
          <ErrorBoundary level="section">
            <GoalsPage
              goals={fd.goals}
              onGoalsChange={fd.onGoalsChange}
              savingsAccounts={fd.savingsAccounts}
              investments={fd.investments}
              creditCards={fd.creditCards}
              people={fd.people}
            />
          </ErrorBoundary>
        } />

        <Route path="/net-worth" element={
          <ErrorBoundary level="section">
            <NetWorthDashboardPage
              savingsAccounts={fd.savingsAccounts}
              expenses={fd.expenses}
              creditCards={fd.creditCards}
              investments={fd.investments}
              assets={fd.assets}
              monthlyIncome={fd.monthlyIncome}
              unemployment={fd.unemployment}
              dataPoints={fd.current.dataPoints}
              currentNetBurn={fd.current.currentNetBurn}
              monthlyBenefits={fd.current.monthlyBenefits}
              jobs={fd.jobs}
            />
          </ErrorBoundary>
        } />

        <Route path="/analysis" element={
          <ErrorBoundary level="section">
            <ComparativeAnalysisPage
              dataPoints={fd.current.dataPoints}
              baseDataPoints={fd.base?.dataPoints}
              jobScenarios={fd.jobScenarios}
              jobScenarioResults={fd.jobScenarioResults}
              totalSavings={fd.totalSavings}
              effectiveExpenses={fd.current.effectiveExpenses}
              currentNetBurn={fd.current.currentNetBurn}
              monthlyBenefits={fd.current.monthlyBenefits}
            />
          </ErrorBoundary>
        } />

        <Route path="/budget" element={
          <ErrorBoundary level="section">
            <BudgetPage
              categoryBudgets={fd.categoryBudgets}
              onCategoryBudgetsChange={fd.onCategoryBudgetsChange}
              allTransactions={fd.effectiveTransactions}
              transactionOverrides={fd.transactionOverrides}
              totalSavings={fd.totalSavings}
              currentNetBurn={fd.current.currentNetBurn}
              totalRunwayMonths={fd.current.totalRunwayMonths}
            />
          </ErrorBoundary>
        } />

        <Route path="/settings" element={
          <ErrorBoundary level="section">
            <UserProfilePage
              user={user}
              updateProfile={updateProfile}
              jobs={fd.jobs}
              onJobsChange={fd.onJobsChange}
              people={fd.people}
              allTransactions={fd.effectiveTransactions}
              transactionOverrides={fd.transactionOverrides}
              properties={fd.properties}
              onPropertiesChange={fd.onPropertiesChange}
              exportData={{
                burndown: fd.current,
                expenses: fd.expenses,
                savingsAccounts: fd.savingsAccounts,
                scenarios: fd.jobScenarios,
                scenarioResults: fd.jobScenarioResults,
                totalSavings: fd.totalSavings,
                unemployment: fd.unemployment,
                creditCards: fd.creditCards,
                monthlyIncome: fd.monthlyIncome,
                investments: fd.investments,
                transactions: fd.effectiveTransactions,
              }}
            />
          </ErrorBoundary>
        } />
        {user?.isSuperAdmin && (
          <>
            <Route path="/admin" element={<SuperAdminPage />} />
            <Route path="/admin/tools" element={<SuperAdminToolsPage />} />
          </>
        )}

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      </div>}
    </div>
    </TierProvider>
    </CommentsProvider>
    </NotificationsProvider>
    </ToastProvider>
    </>
  )
}
