import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { formatCurrency, formatMonths } from '../../utils/formatters'
import { getEffectivePayment } from '../../utils/ccPayment'
import dayjs from 'dayjs'
import EmergencyFloorPanel from './EmergencyFloorPanel'
import BenefitGapPanel from './BenefitGapPanel'
import ExpenseFreezeDatePanel from './ExpenseFreezeDatePanel'
import FreelanceRampPanel from './FreelanceRampPanel'
import ComparePanel from './ComparePanel'

/* ── Scenario row wrapper (accordion) ── */
function ScenarioRow({ id, icon, label, color, summary, delta, isActive, isOpen, onToggle, children }) {
  const deltaColor = delta > 0
    ? 'text-emerald-400'
    : delta < 0
    ? 'text-red-400'
    : ''

  const borderAccent = isActive
    ? `border-l-2 ${color}`
    : 'border-l-2 border-l-transparent'

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-colors ${borderAccent}`}
      style={{
        borderColor: 'var(--border-card)',
        background: isOpen ? 'var(--bg-input)' : 'var(--bg-card)',
      }}
      onMouseEnter={e => {
        if (!isOpen) e.currentTarget.style.background = 'var(--bg-input)'
      }}
      onMouseLeave={e => {
        if (!isOpen) e.currentTarget.style.background = 'var(--bg-card)'
      }}
    >
      {/* Summary row — always visible */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors`}
      >
        <ChevronRight
          size={14}
          strokeWidth={2.5}
          className="flex-shrink-0 transition-transform duration-200"
          style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-medium min-w-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>

        {/* Status summary */}
        <span className="ml-auto flex items-center gap-2 min-w-0">
          {isActive ? (
            <>
              <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--text-muted)' }}>{summary}</span>
              {delta !== null && delta !== 0 && (
                <span className={`text-xs font-bold whitespace-nowrap ${deltaColor}`}>
                  {delta > 0 ? '+' : ''}{formatMonths(Math.abs(delta))}
                </span>
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            </>
          ) : (
            <span className="text-xs italic" style={{ color: 'var(--text-faint)' }}>not set</span>
          )}
        </span>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function WhatIfPanel({
  value,
  onChange,
  onReset,
  baseRunwayMonths,
  altRunwayMonths,
  assetProceeds,
  unemployment,
  expenses,
  subscriptions,
  creditCards,
  templates,
  currentResult,
  templateResults,
  jobScenarios,
  onJobScenariosChange,
  jobScenarioResults,
}) {
  const [openId, setOpenId] = useState(null)

  function toggle(id) {
    setOpenId(prev => prev === id ? null : id)
  }

  function update(field, val) {
    onChange({ ...value, [field]: val })
  }

  const delta = altRunwayMonths != null && baseRunwayMonths != null
    ? altRunwayMonths - baseRunwayMonths
    : null

  // Cost of living breakdown
  const essentialTotal = (expenses || [])
    .filter(e => e.essential)
    .reduce((sum, e) => sum + (Number(e.monthlyAmount) || 0), 0)
  const nonEssentialTotal = (expenses || [])
    .filter(e => !e.essential)
    .reduce((sum, e) => sum + (Number(e.monthlyAmount) || 0), 0)
  const subsTotal = (subscriptions || [])
    .filter(s => s.active !== false)
    .reduce((sum, s) => sum + (Number(s.monthlyAmount) || 0), 0)
  const ccMinTotal = (creditCards || [])
    .reduce((sum, c) => sum + getEffectivePayment(c), 0)
  const totalCostOfLiving = essentialTotal + nonEssentialTotal + subsTotal + ccMinTotal

  const hasChanges =
    value.expenseReductionPct > 0 ||
    (value.expenseRaisePct || 0) > 0 ||
    value.sideIncomeMonthly > 0 ||
    assetProceeds > 0 ||
    (Number(value.emergencyFloor) || 0) > 0 ||
    (Number(value.benefitDelayWeeks) || 0) > 0 ||
    (Number(value.benefitCutWeeks) || 0) > 0 ||
    !!value.freezeDate ||
    (value.freelanceRamp || []).some(t => (Number(t.monthlyAmount) || 0) > 0) ||
    (Number(value.partnerIncomeMonthly) || 0) > 0

  // Scenario activity checks & summaries
  const basicsActive = value.expenseReductionPct > 0 || (value.expenseRaisePct || 0) > 0 || value.sideIncomeMonthly > 0 || assetProceeds > 0
  const basicsSummary = [
    value.expenseReductionPct > 0 && `-${value.expenseReductionPct}%`,
    (value.expenseRaisePct || 0) > 0 && `+${value.expenseRaisePct}% raise`,
    value.sideIncomeMonthly > 0 && `+${formatCurrency(value.sideIncomeMonthly)}/mo`,
    assetProceeds > 0 && `+${formatCurrency(assetProceeds)} assets`,
  ].filter(Boolean).join(', ')

  const floorVal = Number(value.emergencyFloor) || 0
  const floorActive = floorVal > 0
  const floorSummary = formatCurrency(floorVal) + ' reserve'

  const delayWeeks = Number(value.benefitDelayWeeks) || 0
  const cutWeeks = Number(value.benefitCutWeeks) || 0
  const benefitsActive = delayWeeks > 0 || cutWeeks > 0
  const benefitsSummary = [
    delayWeeks > 0 && `${delayWeeks}wk delay`,
    cutWeeks > 0 && `${cutWeeks}wk cut`,
  ].filter(Boolean).join(', ')

  const freezeActive = !!value.freezeDate && value.expenseReductionPct > 0
  const freezeSummary = value.freezeDate
    ? `until ${dayjs(value.freezeDate).format('MMM D')}`
    : ''

  const jobScenariosActive = (jobScenarios || []).length > 0
  const jobScenariosSummary = jobScenariosActive
    ? `${jobScenarios.length} scenario${jobScenarios.length !== 1 ? 's' : ''}`
    : ''

  const ramp = value.freelanceRamp || []
  const freelanceActive = ramp.some(t => (Number(t.monthlyAmount) || 0) > 0)
  const freelanceSummary = freelanceActive
    ? `${ramp.filter(t => t.monthlyAmount > 0).length} phases, up to ${formatCurrency(Math.max(...ramp.map(t => t.monthlyAmount || 0)))}/mo`
    : ''

  const enrichedTemplates = (templates || []).map(t => ({
    ...t,
    _burndownResult: templateResults?.[t.id] || null,
  }))

  return (
    <div className="space-y-2">
      {/* Overall impact bar */}
      {hasChanges && delta !== null && (
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs border ${
          delta > 0 ? 'bg-emerald-950/30 border-emerald-700/30 text-emerald-300'
          : delta < 0 ? 'bg-red-950/30 border-red-700/30 text-red-300'
          : ''
        }`}
        style={delta === 0 ? { background: 'var(--bg-input)', borderColor: 'var(--border-card)', color: 'var(--text-muted)' } : {}}
        >
          <span>
            {delta > 0 ? 'Scenarios extend runway by' : delta < 0 ? 'Scenarios shorten runway by' : 'No net runway change'}
          </span>
          {delta !== 0 && (
            <span className="font-bold text-sm">{delta > 0 ? '+' : ''}{formatMonths(Math.abs(delta))}</span>
          )}
        </div>
      )}

      {/* Accordion rows */}
      <ScenarioRow
        id="basics" icon="⚙️" label="Basics" color="border-l-blue-500"
        isActive={basicsActive} summary={basicsSummary} delta={basicsActive ? delta : null}
        isOpen={openId === 'basics'} onToggle={() => toggle('basics')}
      >
        <div className="space-y-3 pt-2">
          {/* Cost of living summary */}
          {totalCostOfLiving > 0 && (
            <div className="rounded border p-2.5 space-y-1.5" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly Cost of Living</span>
                <span className="text-sm font-bold" style={{ color: 'var(--accent-blue)' }}>
                  {formatCurrency(totalCostOfLiving)}<span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>/mo</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex justify-between">
                  <span>Essential</span>
                  <span className="font-medium">{formatCurrency(essentialTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discretionary</span>
                  <span className="font-medium">{formatCurrency(nonEssentialTotal)}</span>
                </div>
                {subsTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Subscriptions</span>
                    <span className="font-medium">{formatCurrency(subsTotal)}</span>
                  </div>
                )}
                {ccMinTotal > 0 && (
                  <div className="flex justify-between">
                    <span>CC Min. Payments</span>
                    <span className="font-medium">{formatCurrency(ccMinTotal)}</span>
                  </div>
                )}
              </div>
              {((value.expenseRaisePct || 0) > 0 || value.expenseReductionPct > 0) && (
                <div className="pt-1 mt-0.5 flex justify-between items-center text-[10px]" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Adjusted total</span>
                  <span className="font-bold text-xs" style={{ color: (value.expenseRaisePct || 0) > value.expenseReductionPct ? 'var(--accent-red, #ef4444)' : 'var(--accent-emerald)' }}>
                    {formatCurrency(
                      essentialTotal
                      + (nonEssentialTotal * (1 - (value.expenseReductionPct || 0) / 100))
                      + subsTotal + ccMinTotal
                      + totalCostOfLiving * ((value.expenseRaisePct || 0) / 100)
                    )}/mo
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Expense cut - compact inline */}
          <div className="flex items-center gap-2">
            <label className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>Cut expenses</label>
            <input
              type="range" min="0" max="100" step="5"
              value={value.expenseReductionPct}
              onChange={e => update('expenseReductionPct', Number(e.target.value))}
              className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded min-w-[3rem] text-center">
              {value.expenseReductionPct}%
            </span>
          </div>

          {/* Expense raise - compact inline */}
          <div className="flex items-center gap-2">
            <label className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>Raise expenses</label>
            <input
              type="range" min="0" max="50" step="1"
              value={value.expenseRaisePct || 0}
              onChange={e => update('expenseRaisePct', Number(e.target.value))}
              className="flex-1 h-1.5 cursor-pointer"
              style={{ accentColor: '#f97316' }}
            />
            <span className="text-xs font-bold px-1.5 py-0.5 rounded min-w-[3rem] text-center" style={{ color: '#f97316', background: 'rgba(249,115,22,0.12)' }}>
              +{value.expenseRaisePct || 0}%
            </span>
          </div>

          {/* Side income - compact inline */}
          <div className="flex items-center gap-2">
            <label className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>Side income</label>
            <input
              type="range" min="0" max="5000" step="100"
              value={value.sideIncomeMonthly}
              onChange={e => update('sideIncomeMonthly', Number(e.target.value))}
              className="flex-1 h-1.5 accent-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded min-w-[3rem] text-center">
              {formatCurrency(value.sideIncomeMonthly)}
            </span>
          </div>

          {assetProceeds > 0 && (
            <div className="flex items-center justify-between bg-violet-950/20 border border-violet-700/30 rounded px-2.5 py-1.5 text-xs">
              <span className="text-violet-300">Selling assets</span>
              <span className="text-violet-300 font-bold">{formatCurrency(assetProceeds)}</span>
            </div>
          )}
        </div>
      </ScenarioRow>

      <ScenarioRow
        id="floor" icon="🛡️" label="Cash Floor" color="border-l-amber-500"
        isActive={floorActive} summary={floorSummary} delta={floorActive ? delta : null}
        isOpen={openId === 'floor'} onToggle={() => toggle('floor')}
      >
        <EmergencyFloorPanel
          value={value}
          onChange={onChange}
          baseRunwayMonths={baseRunwayMonths}
          altRunwayMonths={altRunwayMonths}
        />
      </ScenarioRow>

      <ScenarioRow
        id="benefits" icon="⚠️" label="Benefit Gap" color="border-l-rose-500"
        isActive={benefitsActive} summary={benefitsSummary} delta={benefitsActive ? delta : null}
        isOpen={openId === 'benefits'} onToggle={() => toggle('benefits')}
      >
        <BenefitGapPanel
          value={value}
          onChange={onChange}
          unemployment={unemployment}
          baseRunwayMonths={baseRunwayMonths}
          altRunwayMonths={altRunwayMonths}
        />
      </ScenarioRow>

      <ScenarioRow
        id="freeze" icon="📅" label="Freeze Date" color="border-l-blue-400"
        isActive={freezeActive} summary={freezeSummary} delta={freezeActive ? delta : null}
        isOpen={openId === 'freeze'} onToggle={() => toggle('freeze')}
      >
        <ExpenseFreezeDatePanel
          value={value}
          onChange={onChange}
          baseRunwayMonths={baseRunwayMonths}
          altRunwayMonths={altRunwayMonths}
        />
      </ScenarioRow>

      <ScenarioRow
        id="scenarios" icon="💼" label="Job Scenarios" color="border-l-emerald-500"
        isActive={jobScenariosActive} summary={jobScenariosSummary} delta={null}
        isOpen={openId === 'scenarios'} onToggle={() => toggle('scenarios')}
      >
        <div className="text-center py-4 space-y-2">
          <Link
            to="/job-scenarios"
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--accent-blue)',
              background: 'var(--accent-blue)' + '18',
              color: 'var(--accent-blue)',
            }}
          >
            Open Job Scenarios Dashboard &rarr;
          </Link>
          {jobScenariosActive && (
            <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
              {jobScenarios.length} scenario{jobScenarios.length !== 1 ? 's' : ''} configured
            </p>
          )}
        </div>
      </ScenarioRow>

      <ScenarioRow
        id="freelance" icon="📈" label="Freelance" color="border-l-teal-500"
        isActive={freelanceActive} summary={freelanceSummary} delta={freelanceActive ? delta : null}
        isOpen={openId === 'freelance'} onToggle={() => toggle('freelance')}
      >
        <FreelanceRampPanel
          value={value}
          onChange={onChange}
          baseRunwayMonths={baseRunwayMonths}
          altRunwayMonths={altRunwayMonths}
        />
      </ScenarioRow>

      <ScenarioRow
        id="compare" icon="⚖️" label="Compare" color="border-l-purple-500"
        isActive={false} summary="" delta={null}
        isOpen={openId === 'compare'} onToggle={() => toggle('compare')}
      >
        <ComparePanel
          templates={enrichedTemplates}
          currentResult={currentResult}
          currentLabel="Current"
        />
      </ScenarioRow>

      {/* Reset button */}
      {hasChanges && (
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-1.5 w-full text-xs px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: 'var(--border-card)', background: 'var(--bg-card)', color: 'var(--text-muted)' }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#f97316'
            e.currentTarget.style.color = '#f97316'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-card)'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 0 1-.025 1.06L6.053 5h6.447a5.5 5.5 0 1 1 0 11H6a.75.75 0 0 1 0-1.5h6.5a4 4 0 1 0 0-8H6.053l1.715 1.708a.75.75 0 0 1-1.06 1.061L4.197 6.757a1 1 0 0 1 0-1.414l2.511-2.511a.75.75 0 0 1 1.085.4z" clipRule="evenodd" />
          </svg>
          Reset all scenarios
        </button>
      )}
    </div>
  )
}
