import { useState } from 'react'
import SectionCard from '../components/layout/SectionCard'
import YearOverYearChart from '../components/chart/YearOverYearChart'
import ScenarioComparisonChart from '../components/chart/ScenarioComparisonChart'
import SavingsVelocityChart from '../components/chart/SavingsVelocityChart'
import SpendingPatternsChart from '../components/chart/SpendingPatternsChart'
import { formatCurrency } from '../utils/formatters'

const TABS = [
  { key: 'all', label: 'All Views' },
  { key: 'yoy', label: 'Year-over-Year' },
  { key: 'scenarios', label: 'Scenarios' },
  { key: 'savings', label: 'Savings Velocity' },
  { key: 'spending', label: 'Spending Patterns' },
]

export default function ComparativeAnalysisPage({
  dataPoints,
  baseDataPoints,
  jobScenarios,
  jobScenarioResults,
  totalSavings,
  effectiveExpenses,
  currentNetBurn,
  monthlyBenefits,
}) {
  const [activeTab, setActiveTab] = useState('all')

  const hasScenarios = jobScenarios?.length > 0 && jobScenarioResults
  const show = key => activeTab === 'all' || activeTab === key

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5">
      {/* Hero banner */}
      <div className="theme-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--accent-blue)' }} />
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Comparative Analysis
          </h2>
        </div>

        <p className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          Financial Trends & Comparisons
        </p>
        <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
          Year-over-year trends, scenario comparisons, savings velocity, and spending pattern analysis.
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

      {/* Tab navigation */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
            style={{
              borderColor: activeTab === tab.key ? 'var(--accent-blue)' : 'var(--border-subtle)',
              background: activeTab === tab.key ? 'var(--accent-blue)' + '20' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent-blue)' : 'var(--text-faint)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Year-over-Year */}
      {show('yoy') && (
        <SectionCard title="Year-over-Year Comparison" id="sec-yoy">
          <YearOverYearChart dataPoints={dataPoints} />
        </SectionCard>
      )}

      {/* Scenario Comparison */}
      {show('scenarios') && (
        <SectionCard title="Scenario Comparison" id="sec-scenarios">
          {hasScenarios ? (
            <ScenarioComparisonChart
              scenarios={jobScenarios}
              scenarioResults={jobScenarioResults}
            />
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">Add job scenarios on the Job Scenarios page to see comparisons here.</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* Savings Velocity */}
      {show('savings') && (
        <SectionCard title="Savings Velocity" id="sec-savings-velocity">
          <SavingsVelocityChart dataPoints={dataPoints} />
        </SectionCard>
      )}

      {/* Spending Patterns */}
      {show('spending') && (
        <SectionCard title="Spending Pattern Analysis" id="sec-spending-patterns">
          <SpendingPatternsChart dataPoints={dataPoints} />
        </SectionCard>
      )}
    </main>
  )
}
