import { useState, useMemo } from 'react'
import { formatCurrency } from '../utils/formatters'
import SectionCard from '../components/layout/SectionCard'
import NetWorthTrendChart from '../components/chart/NetWorthTrendChart'
import CashFlowSummaryChart from '../components/chart/CashFlowSummaryChart'
import FinancialHealthScore from '../components/chart/FinancialHealthScore'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'trends',   label: 'Net Worth Trend' },
  { key: 'cashflow', label: 'Cash Flow' },
]

function StatCard({ label, value, sub, color }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums" style={{ color: color || 'var(--text-primary)' }}>
        {value}
      </span>
      {sub && (
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sub}</span>
      )}
    </div>
  )
}

function AssetBreakdown({ savingsAccounts, assets, investments, creditCards }) {
  const activeAccounts = savingsAccounts.filter(a => a.active !== false)
  const totalCash = activeAccounts.reduce((s, a) => s + (Number(a.amount) || 0), 0)
  const totalAssets = assets.reduce((s, a) => s + (Number(a.estimatedValue) || 0), 0)
  const totalInvestments = investments
    .filter(i => i.active !== false)
    .reduce((s, i) => s + (Number(i.currentValue || i.monthlyAmount * 12) || 0), 0)
  const totalDebt = creditCards.reduce((s, c) => s + (Number(c.balance) || 0), 0)

  const items = [
    { label: 'Cash & Savings', amount: totalCash, color: '#3b82f6' },
    { label: 'Assets', amount: totalAssets, color: '#a855f7' },
    ...(totalInvestments > 0 ? [{ label: 'Investments (est.)', amount: totalInvestments, color: '#06b6d4' }] : []),
  ]

  const totalPositive = items.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 h-3 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
        {totalPositive > 0 && items.map((item, i) => (
          <div
            key={i}
            style={{
              width: `${(item.amount / totalPositive) * 100}%`,
              background: item.color,
              height: '100%',
              minWidth: item.amount > 0 ? 4 : 0,
              borderRadius: i === 0 ? '9999px 0 0 9999px' : i === items.length - 1 ? '0 9999px 9999px 0' : 0,
            }}
          />
        ))}
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(item.amount)}
            </span>
          </div>
        ))}
        {totalDebt > 0 && (
          <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Liabilities</span>
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: '#ef4444' }}>
              −{formatCurrency(totalDebt)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NetWorthDashboardPage({
  savingsAccounts = [],
  expenses = [],
  creditCards = [],
  investments = [],
  assets = [],
  monthlyIncome = [],
  unemployment = {},
  dataPoints = [],
  currentNetBurn = 0,
  monthlyBenefits = 0,
  jobs = [],
}) {
  const [activeTab, setActiveTab] = useState('overview')

  // Compute key metrics
  const metrics = useMemo(() => {
    const totalCash = savingsAccounts
      .filter(a => a.active !== false)
      .reduce((s, a) => s + (Number(a.amount) || 0), 0)

    const totalAssets = assets.reduce((s, a) => s + (Number(a.estimatedValue) || 0), 0)

    const totalDebt = creditCards.reduce((s, c) => s + (Number(c.balance) || 0), 0)

    const netWorth = totalCash + totalAssets - totalDebt

    const totalMonthlyIncome = monthlyIncome.reduce((s, x) => s + (Number(x.monthlyAmount) || 0), 0)
      + monthlyBenefits
      + jobs.filter(j => j.status === 'active').reduce((s, j) => s + (Number(j.monthlySalary) || 0), 0)

    const totalMonthlyExpenses = expenses.reduce((s, e) => s + (Number(e.monthlyAmount) || 0), 0)

    const monthlyCashFlow = totalMonthlyIncome - totalMonthlyExpenses

    return {
      totalCash,
      totalAssets,
      totalDebt,
      netWorth,
      totalMonthlyIncome,
      totalMonthlyExpenses,
      monthlyCashFlow,
    }
  }, [savingsAccounts, assets, creditCards, monthlyIncome, monthlyBenefits, jobs, expenses])

  const netWorthColor = metrics.netWorth >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'
  const cashFlowColor = metrics.monthlyCashFlow >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-32 space-y-6">
      {/* Hero */}
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Net Worth Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Your financial health at a glance
        </p>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Net Worth"
          value={metrics.netWorth >= 0 ? formatCurrency(metrics.netWorth) : `−${formatCurrency(Math.abs(metrics.netWorth))}`}
          color={netWorthColor}
          sub={`${formatCurrency(metrics.totalCash)} cash + ${formatCurrency(metrics.totalAssets)} assets`}
        />
        <StatCard
          label="Total Debt"
          value={formatCurrency(metrics.totalDebt)}
          color={metrics.totalDebt > 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'}
          sub={`${creditCards.length} credit card${creditCards.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Monthly Income"
          value={formatCurrency(metrics.totalMonthlyIncome)}
          color="var(--accent-emerald)"
        />
        <StatCard
          label="Monthly Cash Flow"
          value={metrics.monthlyCashFlow >= 0
            ? `+${formatCurrency(metrics.monthlyCashFlow)}`
            : `−${formatCurrency(Math.abs(metrics.monthlyCashFlow))}`}
          color={cashFlowColor}
          sub={metrics.monthlyCashFlow >= 0 ? 'Saving money' : 'Spending more than earning'}
        />
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ color: activeTab === tab.key ? 'var(--accent-blue)' : 'var(--text-muted)' }}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span
                className="absolute bottom-0 inset-x-2 h-0.5 rounded-full"
                style={{ background: 'var(--accent-blue)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Financial Health Score">
            <FinancialHealthScore
              totalSavings={metrics.totalCash}
              totalDebt={metrics.totalDebt}
              monthlyExpenses={metrics.totalMonthlyExpenses}
              monthlyIncome={metrics.totalMonthlyIncome}
              assetTotal={metrics.totalAssets}
            />
          </SectionCard>

          <SectionCard title="Asset Breakdown">
            <AssetBreakdown
              savingsAccounts={savingsAccounts}
              assets={assets}
              investments={investments}
              creditCards={creditCards}
            />
          </SectionCard>
        </div>
      )}

      {activeTab === 'trends' && (
        <SectionCard title="Net Worth Over Time">
          <NetWorthTrendChart
            dataPoints={dataPoints}
            assetTotal={metrics.totalAssets}
          />
        </SectionCard>
      )}

      {activeTab === 'cashflow' && (
        <SectionCard title="Monthly Cash Flow">
          <CashFlowSummaryChart
            dataPoints={dataPoints}
            months={12}
          />
        </SectionCard>
      )}
    </div>
  )
}
