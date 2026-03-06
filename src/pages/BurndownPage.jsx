import { useState } from 'react'
import SectionCard from '../components/layout/SectionCard'
import RunwayBanner from '../components/dashboard/RunwayBanner'
import ChartTabsSection from '../components/chart/ChartTabsSection'
import SavingsPanel from '../components/finances/SavingsPanel'
import UnemploymentPanel from '../components/finances/UnemploymentPanel'
import ExpensePanel from '../components/finances/ExpensePanel'
import OneTimeExpensePanel from '../components/finances/OneTimeExpensePanel'
import OneTimePurchasePanel from '../components/finances/OneTimePurchasePanel'
import OneTimeIncomePanel from '../components/finances/OneTimeIncomePanel'
import MonthlyIncomePanel from '../components/finances/MonthlyIncomePanel'
import AdvertisingRevenuePanel from '../components/finances/AdvertisingRevenuePanel'

import AssetsPanel from '../components/finances/AssetsPanel'
import InvestmentsPanel from '../components/finances/InvestmentsPanel'
import SubscriptionsPanel from '../components/finances/SubscriptionsPanel'
import CreditCardsPanel from '../components/finances/CreditCardsPanel'
import WhatIfPanel from '../components/scenarios/WhatIfPanel'
import ConnectedAccountsPanel from '../components/plaid/ConnectedAccountsPanel'
import PropertyPanel from '../components/finances/PropertyPanel'
import HomeImprovementPanel from '../components/finances/HomeImprovementPanel'
import TransactionLookupModal from '../components/linking/TransactionLookupModal'

export default function BurndownPage({
  current,
  base,
  hasWhatIf,
  totalSavings,
  viewSettings,
  // Data
  people,
  savingsAccounts,
  unemployment,
  expenses,
  whatIf,
  oneTimeExpenses,
  oneTimePurchases,
  oneTimeIncome,
  monthlyIncome,
  assets,
  investments,
  subscriptions,
  creditCards,
  jobScenarios,
  // Change handlers
  onSavingsChange,
  onUnemploymentChange,
  onFurloughChange,
  onExpensesChange,
  onWhatIfChange,
  onOneTimeExpChange,
  onOneTimePurchChange,
  onOneTimeIncChange,
  onMonthlyIncChange,
  onAssetsChange,
  onInvestmentsChange,
  onSubsChange,
  onCreditCardsChange,
  onJobScenariosChange,
  // Properties & Home Improvements
  properties,
  homeImprovements,
  onPropertiesChange,
  onHomeImprovementsChange,
  // Advertising
  advertisingRevenue,
  onAdvertisingRevenueChange,
  // What-if extras
  furloughDate,
  derivedStartDate,
  assetProceeds,
  onWhatIfReset,
  templates,
  templateResults,
  jobScenarioResults,
  plaid,
  // Transaction linking
  allTransactions = [],
  transactionLinks = {},
  txnToOverviewMap = {},
  onLinkTransaction,
  onUnlinkTransaction,
  transactionOverrides = {},
  // Historical snapshot comparison
  snapshots,
  historicalDate,
  historicalBurndown,
  onHistoricalDateSelect,
}) {
  const [lookupState, setLookupState] = useState(null) // { overviewKey, overviewItem }

  function handleOpenLookup(overviewKey, overviewItem) {
    setLookupState({ overviewKey, overviewItem })
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5">

      {/* Hero banner */}
      <div id="sec-runway" className="scroll-mt-20">
        <RunwayBanner
          runoutDate={current.runoutDate}
          totalRunwayMonths={current.totalRunwayMonths}
          currentNetBurn={current.currentNetBurn}
          savings={totalSavings}
        />
      </div>

      {/* Chart tabs */}
      <ChartTabsSection
        dataPoints={current.dataPoints}
        runoutDate={current.runoutDate}
        baseDataPoints={hasWhatIf ? base.dataPoints : null}
        benefitStart={current.benefitStart}
        benefitEnd={current.benefitEnd}
        emergencyFloor={current.emergencyFloor}
        showEssentials={viewSettings.chartLines.essentialsOnly}
        showBaseline={viewSettings.chartLines.baseline}
        expenses={expenses}
        subscriptions={subscriptions}
        creditCards={creditCards}
        investments={investments}
        monthlyBenefits={current.monthlyBenefits}
        availableDates={snapshots?.availableDates || []}
        selectedHistoricalDate={historicalDate}
        historicalBurndown={historicalBurndown}
        snapshotLoading={snapshots?.snapshotLoading || false}
        onHistoricalDateSelect={onHistoricalDateSelect}
      />

      {/* Two-column inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          <SectionCard id="sec-savings" title="Cash & Savings Accounts" className="scroll-mt-20">
            <SavingsPanel accounts={savingsAccounts} onChange={onSavingsChange} people={people} />
          </SectionCard>

          <SectionCard id="sec-unemployment" title="Unemployment Benefits" className="scroll-mt-20">
            <UnemploymentPanel value={unemployment} onChange={onUnemploymentChange} furloughDate={furloughDate} onFurloughDateChange={onFurloughChange} people={people} derivedStartDate={derivedStartDate} />
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {viewSettings.sections.whatif && (
            <SectionCard id="sec-whatif" title="What-If Scenarios" className="scroll-mt-20">
              <WhatIfPanel
                value={whatIf}
                onChange={onWhatIfChange}
                onReset={onWhatIfReset}
                baseRunwayMonths={base.totalRunwayMonths}
                altRunwayMonths={current.totalRunwayMonths}
                assetProceeds={assetProceeds}
                unemployment={unemployment}
                expenses={expenses}
                subscriptions={subscriptions}
                creditCards={creditCards}
                templates={templates}
                currentResult={current}
                templateResults={templateResults}
                jobScenarios={jobScenarios}
                onJobScenariosChange={onJobScenariosChange}
                jobScenarioResults={jobScenarioResults}
              />
            </SectionCard>
          )}

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="theme-card rounded-xl border p-4">
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Monthly Expenses</p>
              <p className="text-xl font-bold text-primary">
                ${Math.round(current.effectiveExpenses).toLocaleString()}
              </p>
              <p className="text-xs text-faint mt-0.5">after any reductions</p>
            </div>
            <div className="theme-card rounded-xl border p-4">
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">UI Income / Mo</p>
              <p className="text-xl font-bold" style={{ color: 'var(--accent-emerald)' }}>
                ${Math.round(current.monthlyBenefits).toLocaleString()}
              </p>
              <p className="text-xs text-faint mt-0.5">
                until {(() => {
                  const d = current.benefitEnd
                  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'
                })()}
              </p>
            </div>
            {current.monthlyInvestments > 0 && (
              <div className="theme-card rounded-xl border p-4 col-span-2">
                <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Active Investments / Mo</p>
                <p className="text-xl font-bold" style={{ color: 'var(--accent-teal)' }}>
                  -${Math.round(current.monthlyInvestments).toLocaleString()}
                </p>
                <p className="text-xs text-faint mt-0.5">added to monthly burn</p>
              </div>
            )}
            {current.totalMonthlyIncome > 0 && (
              <div className="theme-card rounded-xl border p-4 col-span-2">
                <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Monthly Income / Mo</p>
                <p className="text-xl font-bold" style={{ color: 'var(--accent-emerald)' }}>
                  +${Math.round(current.totalMonthlyIncome).toLocaleString()}
                </p>
                <p className="text-xs text-faint mt-0.5">reduces monthly burn</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subscriptions — full width */}
      {viewSettings.sections.subscriptions && (
        <SectionCard id="sec-subscriptions" title="Subscriptions" className="scroll-mt-20">
          <SubscriptionsPanel subscriptions={subscriptions} onChange={onSubsChange} people={people} />
        </SectionCard>
      )}

      {/* Credit cards / outstanding debt — full width */}
      {viewSettings.sections.creditCards && (
        <SectionCard id="sec-creditcards" title="Credit Cards / Outstanding Debt" className="scroll-mt-20">
          <CreditCardsPanel cards={creditCards} onChange={onCreditCardsChange} people={people} />
        </SectionCard>
      )}

      {/* Connected bank accounts via Plaid — full width */}
      {viewSettings.sections.plaidAccounts && import.meta.env.VITE_PLAID_API_URL && plaid && (
        <SectionCard id="sec-plaid" title="Connected Bank Accounts" className="scroll-mt-20">
          <ConnectedAccountsPanel
            linkedItems={plaid.linkedItems}
            syncing={plaid.syncing}
            lastSync={plaid.lastSync}
            error={plaid.error}
            loading={plaid.loading}
            fetchAccounts={plaid.fetchAccounts}
            syncAll={plaid.syncAll}
            disconnect={plaid.disconnect}
            hasFetched={plaid.hasFetched}
          />
        </SectionCard>
      )}

      {/* Monthly expense breakdown — full width */}
      <SectionCard id="sec-expenses" title="Monthly Expenses" className="scroll-mt-20">
        <ExpensePanel expenses={expenses} onChange={onExpensesChange} people={people} />
      </SectionCard>

      {/* Monthly investments — full width */}
      {viewSettings.sections.investments && (
        <SectionCard id="sec-investments" title="Monthly Investments" className="scroll-mt-20">
          <InvestmentsPanel investments={investments} onChange={onInvestmentsChange} people={people} />
        </SectionCard>
      )}


      {/* One-time expenses — full width */}
      {viewSettings.sections.onetimes && (
        <SectionCard id="sec-onetimes" title="One-Time Expenses" className="scroll-mt-20">
          <OneTimeExpensePanel
            expenses={oneTimeExpenses}
            onChange={onOneTimeExpChange}
            people={people}
            allTransactions={allTransactions}
            transactionLinks={transactionLinks}
            onOpenTransactionLookup={handleOpenLookup}
          />
        </SectionCard>
      )}

      {/* One-time purchases (losses) — full width */}
      {viewSettings.sections.onetimePurchases && (
        <SectionCard id="sec-onetimepurchases" title="One-Time Purchases" className="scroll-mt-20">
          <OneTimePurchasePanel
            purchases={oneTimePurchases}
            onChange={onOneTimePurchChange}
            people={people}
            allTransactions={allTransactions}
            transactionLinks={transactionLinks}
            onOpenTransactionLookup={handleOpenLookup}
          />
        </SectionCard>
      )}

      {/* One-time income injections — full width */}
      {viewSettings.sections.onetimeIncome && (
        <SectionCard id="sec-onetimeincome" title="One-Time Income Injections" className="scroll-mt-20">
          <OneTimeIncomePanel
            items={oneTimeIncome}
            onChange={onOneTimeIncChange}
            people={people}
            allTransactions={allTransactions}
            transactionLinks={transactionLinks}
            onOpenTransactionLookup={handleOpenLookup}
          />
        </SectionCard>
      )}

      {/* Monthly income — full width */}
      {viewSettings.sections.monthlyIncome && (
        <SectionCard id="sec-monthlyincome" title="Monthly Income" className="scroll-mt-20">
          <MonthlyIncomePanel items={monthlyIncome} onChange={onMonthlyIncChange} people={people} />
        </SectionCard>
      )}

      {/* Advertising vs Ad Revenue — full width */}
      {viewSettings.sections.advertisingRevenue && (
        <SectionCard id="sec-advertisingrevenue" title="Advertising vs Ad Revenue" className="scroll-mt-20">
          <AdvertisingRevenuePanel value={advertisingRevenue} onChange={onAdvertisingRevenueChange} people={people} />
        </SectionCard>
      )}

      {/* Sellable assets — full width */}
      {viewSettings.sections.assets && (
        <SectionCard id="sec-assets" title="Sellable Assets" className="scroll-mt-20">
          <AssetsPanel assets={assets} onChange={onAssetsChange} people={people} />
        </SectionCard>
      )}

      {/* Properties — full width */}
      {viewSettings.sections.properties && (
        <SectionCard id="sec-properties" title="Properties" className="scroll-mt-20">
          <PropertyPanel properties={properties} onChange={onPropertiesChange} />
        </SectionCard>
      )}

      {/* Home Improvements — full width */}
      {viewSettings.sections.homeImprovements && (
        <SectionCard id="sec-homeimprovements" title="Home Improvements" className="scroll-mt-20">
          <HomeImprovementPanel
            improvements={homeImprovements}
            onChange={onHomeImprovementsChange}
            properties={properties}
            people={people}
          />
        </SectionCard>
      )}

      {/* Transaction lookup modal */}
      {lookupState && (
        <TransactionLookupModal
          open={true}
          overviewKey={lookupState.overviewKey}
          overviewItem={lookupState.overviewItem}
          allTransactions={allTransactions}
          linkedTransactions={transactionLinks[lookupState.overviewKey] || []}
          txnToOverviewMap={txnToOverviewMap}
          onLink={onLinkTransaction}
          onUnlink={onUnlinkTransaction}
          onClose={() => setLookupState(null)}
        />
      )}

      <p className="text-center text-xs text-faint pb-4">
        Templates are saved to your browser's local storage and persist between sessions.
      </p>
    </main>
  )
}
