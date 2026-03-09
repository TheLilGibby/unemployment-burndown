import { memo, useMemo } from 'react'
import { useChartColors } from '../../hooks/useChartColors'

function ScoreGauge({ score, size = 160, chartColors }) {
  const radius = (size - 20) / 2
  const circumference = Math.PI * radius // semicircle
  const progress = (score / 100) * circumference

  const color = score >= 80 ? chartColors.emerald : score >= 60 ? chartColors.blue : score >= 40 ? chartColors.amber : chartColors.red
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work'

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background arc */}
        <path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke={chartColors.borderSubtle}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M 10 ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2 + 10}`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        {/* Score text */}
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fill={color}
          fontSize="32"
          fontWeight="bold"
        >
          {score}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          fill={chartColors.textMuted}
          fontSize="12"
        >
          {label}
        </text>
      </svg>
    </div>
  )
}

function RatioRow({ label, value, status, detail, chartColors }) {
  const colors = {
    good: chartColors.emerald,
    warning: chartColors.amber,
    danger: chartColors.red,
    neutral: chartColors.textSecondary,
  }
  return (
    <div className="flex items-center justify-between py-2.5 px-1">
      <div className="flex-1 min-w-0">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        {detail && (
          <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-muted)' }}>{detail}</span>
        )}
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color: colors[status] || colors.neutral }}>
        {value}
      </span>
    </div>
  )
}

function FinancialHealthScore({
  totalSavings = 0,
  totalDebt = 0,
  monthlyExpenses = 0,
  monthlyIncome = 0,
  monthlyInvestments = 0,
  assetTotal = 0,
}) {
  const c = useChartColors()

  const metrics = useMemo(() => {
    // Emergency fund months
    const emergencyMonths = monthlyExpenses > 0
      ? totalSavings / monthlyExpenses
      : totalSavings > 0 ? 99 : 0

    // Savings rate (% of income saved/invested)
    const totalMonthly = monthlyIncome
    const totalSaved = Math.max(0, monthlyIncome - monthlyExpenses)
    const savingsRate = totalMonthly > 0 ? (totalSaved / totalMonthly) * 100 : 0

    // Debt-to-income ratio
    const debtToIncome = monthlyIncome > 0
      ? (totalDebt / (monthlyIncome * 12)) * 100
      : totalDebt > 0 ? 999 : 0

    // Net worth
    const netWorth = totalSavings + assetTotal - totalDebt

    // Housing cost ratio (approximate - use 30% threshold as reference)
    // Not directly available, so we skip or compute from expenses

    // Compute composite health score (0-100)
    let score = 0

    // Emergency fund: 30 points max
    if (emergencyMonths >= 6) score += 30
    else if (emergencyMonths >= 3) score += 20
    else if (emergencyMonths >= 1) score += 10
    else score += 0

    // Savings rate: 25 points max
    if (savingsRate >= 20) score += 25
    else if (savingsRate >= 10) score += 18
    else if (savingsRate >= 5) score += 10
    else if (savingsRate > 0) score += 5

    // Debt level: 25 points max
    if (debtToIncome <= 0) score += 25
    else if (debtToIncome <= 20) score += 20
    else if (debtToIncome <= 40) score += 12
    else if (debtToIncome <= 60) score += 5

    // Net worth positive: 20 points max
    if (netWorth > totalSavings) score += 20
    else if (netWorth > 0) score += 15
    else if (netWorth === 0) score += 5

    return {
      emergencyMonths,
      savingsRate,
      debtToIncome,
      netWorth,
      score: Math.min(100, Math.round(score)),
    }
  }, [totalSavings, totalDebt, monthlyExpenses, monthlyIncome, assetTotal])

  return (
    <div>
      <ScoreGauge score={metrics.score} chartColors={c} />

      <div className="mt-4 divide-y" style={{ borderColor: c.borderSubtle }}>
        <RatioRow
          label="Emergency Fund"
          value={metrics.emergencyMonths >= 99 ? '99+ mo' : `${metrics.emergencyMonths.toFixed(1)} mo`}
          status={metrics.emergencyMonths >= 6 ? 'good' : metrics.emergencyMonths >= 3 ? 'warning' : 'danger'}
          detail={metrics.emergencyMonths >= 6 ? '6+ months ideal' : 'Target: 6 months'}
          chartColors={c}
        />
        <RatioRow
          label="Savings Rate"
          value={`${metrics.savingsRate.toFixed(1)}%`}
          status={metrics.savingsRate >= 20 ? 'good' : metrics.savingsRate >= 10 ? 'warning' : 'danger'}
          detail={metrics.savingsRate >= 20 ? 'On track' : 'Target: 20%'}
          chartColors={c}
        />
        <RatioRow
          label="Debt-to-Income"
          value={metrics.debtToIncome > 100 ? '>100%' : `${metrics.debtToIncome.toFixed(1)}%`}
          status={metrics.debtToIncome <= 20 ? 'good' : metrics.debtToIncome <= 40 ? 'warning' : 'danger'}
          detail={metrics.debtToIncome <= 20 ? 'Healthy' : 'Target: <20%'}
          chartColors={c}
        />
      </div>
    </div>
  )
}

export default memo(FinancialHealthScore)
