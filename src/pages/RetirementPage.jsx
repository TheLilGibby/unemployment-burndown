import SectionCard from '../components/layout/SectionCard'
import RetirementPanel from '../components/finances/RetirementPanel'
import { formatCurrency } from '../utils/formatters'
import { computeRetirementProjection } from '../utils/retirementProjection'
import { useMemo } from 'react'

export default function RetirementPage({ retirement, onRetirementChange, people = [] }) {
  const effectiveTarget = retirement.targetMode === 'income'
    ? Math.round((Number(retirement.desiredAnnualIncome) || 0) / ((Number(retirement.withdrawalRatePct) || 4) / 100))
    : Number(retirement.targetNestEgg) || 0

  const projection = useMemo(() => computeRetirementProjection({
    currentAge: Number(retirement.currentAge) || 30,
    targetRetirementAge: Number(retirement.targetRetirementAge) || 65,
    currentBalance: Number(retirement.currentBalance) || 0,
    monthlyContribution: Number(retirement.monthlyContribution) || 0,
    annualReturnPct: Number(retirement.annualReturnPct) || 7,
    inflationPct: Number(retirement.inflationPct) || 3,
    targetNestEgg: effectiveTarget,
  }), [retirement, effectiveTarget])

  const yearsToRetirement = Math.max(0, (Number(retirement.targetRetirementAge) || 65) - (Number(retirement.currentAge) || 30))
  const onTrack = projection.hitsGoal

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5">
      {/* Hero banner */}
      <div className="theme-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#6366f1' }} />
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Retirement Planning
          </h2>
        </div>

        <p className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {onTrack ? 'On Track' : 'Behind Schedule'}
        </p>
        <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
          Plan and project your retirement savings — set goals, model contributions, and track your progress.
        </p>

        <div className="flex flex-wrap gap-6 sm:gap-10 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Current Savings</p>
            <p className="text-xl font-semibold" style={{ color: '#6366f1' }}>
              {formatCurrency(Number(retirement.currentBalance) || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Target</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--accent-amber)' }}>
              {formatCurrency(effectiveTarget)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Projected at Retirement</p>
            <p className="text-xl font-semibold" style={{ color: onTrack ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
              {formatCurrency(projection.projectedAtRetirement)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Years to Go</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {yearsToRetirement}
            </p>
          </div>
        </div>
      </div>

      {/* Retirement planning panel */}
      <SectionCard id="sec-retirement" title="Retirement Projection" className="scroll-mt-20">
        <RetirementPanel data={retirement} onChange={onRetirementChange} people={people} />
      </SectionCard>
    </main>
  )
}
