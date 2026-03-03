import SectionCard from '../layout/SectionCard'
import EnhancedJobScenariosForm from './EnhancedJobScenariosForm'
import WaterfallChart from '../chart/WaterfallChart'
import SavingsGrowthChart from '../chart/SavingsGrowthChart'
import InvestmentGrowthChart from '../chart/InvestmentGrowthChart'
import TaxComparisonChart from '../chart/TaxComparisonChart'
import SalaryGrowthChart from '../chart/SalaryGrowthChart'
import { formatCurrency, formatMonths } from '../../utils/formatters'
import { computeAllocationAmount, computeMinimumGrossSalary } from '../../utils/stateTaxRates'

export default function JobScenariosPage({
  jobScenarios,
  onJobScenariosChange,
  jobScenarioResults,
  totalSavings,
  effectiveExpenses,
  monthlyBenefits,
  monthlyInvestments,
  currentNetBurn,
}) {
  const baselineResult = jobScenarioResults?.['__baseline__']

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5">
      {/* Hero banner — mirrors RunwayBanner structure */}
      <div className="theme-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--accent-blue)' }} />
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Job Scenarios
          </h2>
        </div>

        <p className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {jobScenarios.length} {jobScenarios.length === 1 ? 'Scenario' : 'Scenarios'}
        </p>
        <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
          Compare job offers side-by-side — salary, location, and start date impact on your runway.
        </p>

        <div className="flex flex-wrap gap-6 sm:gap-10 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Current Savings</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--accent-blue)' }}>{formatCurrency(totalSavings)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Expenses / Mo</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--accent-red)' }}>{formatCurrency(effectiveExpenses)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>UI Benefits / Mo</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--accent-emerald)' }}>{formatCurrency(monthlyBenefits)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Net Burn / Mo</p>
            <p className={`text-xl font-semibold ${currentNetBurn > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {currentNetBurn > 0 ? '-' : '+'}{formatCurrency(Math.abs(currentNetBurn))}
            </p>
          </div>
        </div>
      </div>

      {/* Scenario form */}
      <SectionCard title="Scenarios">
        <EnhancedJobScenariosForm
          scenarios={jobScenarios}
          onChange={onJobScenariosChange}
          scenarioResults={jobScenarioResults}
          effectiveExpenses={effectiveExpenses}
        />
      </SectionCard>

      {/* Charts dashboard */}
      {jobScenarios.length > 0 && jobScenarioResults && (
        <div className="space-y-5" id="sec-scenarios-charts">
          {/* Salary growth - full width feature chart */}
          <SectionCard title="Salary Growth Projection">
            <SalaryGrowthChart scenarios={jobScenarios} effectiveExpenses={effectiveExpenses} />
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard title="Take-Home Waterfall">
              <WaterfallChart scenarios={jobScenarios} />
            </SectionCard>

            <SectionCard title="5-Year Savings Growth">
              <SavingsGrowthChart
                scenarios={jobScenarios}
                scenarioResults={jobScenarioResults}
              />
            </SectionCard>

            <SectionCard title="Investment Growth Projection">
              <InvestmentGrowthChart scenarios={jobScenarios} />
            </SectionCard>

            <SectionCard title="Tax Burden Comparison">
              <TaxComparisonChart scenarios={jobScenarios} />
            </SectionCard>
          </div>
        </div>
      )}

      {/* Comparison table */}
      {jobScenarios.length > 0 && jobScenarioResults && (
        <SectionCard title="Scenario Comparison">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Baseline */}
            {baselineResult && (
              <div className="rounded-lg border px-4 py-3 space-y-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>No Job (Baseline)</p>
                </div>
                <MetricRow label="Runway" value={baselineResult.runoutDate ? formatMonths(baselineResult.totalRunwayMonths) : 'Beyond 10 yrs'} />
                <MetricRow label="Year 1" value={formatCurrency(baselineResult.dataPoints[12]?.balance ?? 0)} />
                <MetricRow label="Year 3" value={formatCurrency(baselineResult.dataPoints[36]?.balance ?? 0)} />
                <MetricRow label="Year 5" value={formatCurrency(baselineResult.dataPoints[Math.min(60, baselineResult.dataPoints.length - 1)]?.balance ?? 0)} />
              </div>
            )}

            {/* Scenario cards */}
            {jobScenarios.map(s => {
              const result = jobScenarioResults[s.id]
              if (!result) return null
              const netMonthly = s.monthlyTakeHome - effectiveExpenses
              const surplus = s.monthlyTakeHome - result.effectiveExpenses
              const monthlyTax = ((s.grossAnnualSalary || 0) / 12) - s.monthlyTakeHome
              const savingsAmt = computeAllocationAmount(s.savingsAllocation, s.savingsAllocationType, s.monthlyTakeHome)
              const investAmt = computeAllocationAmount(s.investmentAllocation, s.investmentAllocationType, s.monthlyTakeHome)
              const minGross = computeMinimumGrossSalary(effectiveExpenses, s.taxRatePct)
              const meetsMinimum = s.grossAnnualSalary >= minGross

              return (
                <div
                  key={s.id}
                  className="rounded-lg border px-4 py-3 space-y-2"
                  style={{ borderColor: s.color + '40', background: s.color + '08' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <p className="text-xs font-semibold truncate" style={{ color: s.color }}>{s.name}</p>
                  </div>
                  <MetricRow label="Gross Annual" value={formatCurrency(s.grossAnnualSalary)} />
                  <MetricRow label="Annual Raise" value={(s.annualRaisePct ?? 0) + '%/yr'} valueColor="var(--accent-blue)" />
                  {(s.annualRaisePct ?? 0) > 0 && (
                    <MetricRow
                      label="Year 5 Salary"
                      value={formatCurrency(s.grossAnnualSalary * Math.pow(1 + (s.annualRaisePct || 0) / 100, 5))}
                      valueColor="var(--accent-blue)"
                    />
                  )}
                  <MetricRow label="Monthly Take-Home" value={formatCurrency(s.monthlyTakeHome)} valueColor="var(--accent-emerald)" />
                  <MetricRow label="Monthly Taxes" value={formatCurrency(monthlyTax)} valueColor="var(--accent-red)" />
                  <MetricRow
                    label="Net Monthly"
                    value={(netMonthly >= 0 ? '+' : '') + formatCurrency(netMonthly) + '/mo'}
                    valueColor={netMonthly >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
                  />
                  <MetricRow
                    label="Min Required Salary"
                    value={formatCurrency(minGross) + '/yr'}
                    valueColor={meetsMinimum ? 'var(--accent-emerald)' : '#f59e0b'}
                  />
                  <MetricRow label="To Savings" value={formatCurrency(savingsAmt) + '/mo'} valueColor="#f59e0b" />
                  <MetricRow label="To Investments" value={formatCurrency(investAmt) + '/mo'} valueColor="#a855f7" />
                  {(s.signingBonus || 0) > 0 && (
                    <MetricRow label="Signing Bonus" value={formatCurrency(s.signingBonus)} valueColor="var(--accent-emerald)" />
                  )}
                  {(s.annualBonusPct || 0) > 0 && (
                    <MetricRow
                      label="Annual Bonus"
                      value={s.annualBonusPct + '% (' + formatCurrency(s.grossAnnualSalary * s.annualBonusPct / 100 * (1 - s.taxRatePct / 100)) + ' net)'}
                      valueColor="var(--accent-emerald)"
                    />
                  )}
                  {(s.employerBenefitsMonthly || 0) > 0 && (
                    <MetricRow label="Benefits Value" value={formatCurrency(s.employerBenefitsMonthly) + '/mo'} valueColor="var(--accent-blue)" />
                  )}
                  {(s.employer401kMatchPct || 0) > 0 && (
                    <MetricRow label="401k Match" value={s.employer401kMatchPct + '%'} valueColor="#a855f7" />
                  )}
                  {(s.equityAnnual || 0) > 0 && (
                    <MetricRow label="Equity/RSUs" value={formatCurrency(s.equityAnnual) + '/yr'} valueColor="var(--accent-blue)" />
                  )}
                  {(s.commuteMonthly || 0) > 0 && (
                    <MetricRow label="Commute" value={formatCurrency(s.commuteMonthly) + '/mo'} valueColor="var(--accent-red)" />
                  )}
                  <MetricRow
                    label="Total Comp (yr 1)"
                    value={formatCurrency(
                      s.grossAnnualSalary +
                      (s.signingBonus || 0) +
                      s.grossAnnualSalary * (s.annualBonusPct || 0) / 100 +
                      (s.equityAnnual || 0)
                    )}
                    valueColor="var(--accent-blue)"
                  />
                  <MetricRow
                    label="Monthly Surplus"
                    value={formatCurrency(surplus) + '/mo'}
                    valueColor={surplus >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
                  />
                  <MetricRow label="Runway" value={result.runoutDate ? formatMonths(result.totalRunwayMonths) : 'Beyond 10 yrs'} />
                  <MetricRow label="Year 1" value={formatCurrency(result.dataPoints[12]?.balance ?? 0)} />
                  <MetricRow label="Year 5" value={formatCurrency(result.dataPoints[Math.min(60, result.dataPoints.length - 1)]?.balance ?? 0)} />
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}
    </main>
  )
}

function MetricRow({ label, value, valueColor }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-medium" style={{ color: valueColor || 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}
