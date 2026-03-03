import { useState } from 'react'
import dayjs from 'dayjs'
import { formatCurrency, formatMonths, formatDate } from '../../utils/formatters'
import CurrencyInput from '../finances/CurrencyInput'
import JobScenariosChart from '../chart/JobScenariosChart'

const SCENARIO_COLORS = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
]

const MAX_SCENARIOS = 6

const today = dayjs('2026-02-21')
const minDate = today.add(1, 'day').format('YYYY-MM-DD')

export default function JobScenariosPanel({ scenarios, onChange, scenarioResults }) {
  const [newName, setNewName] = useState('')
  const [newSalary, setNewSalary] = useState(0)
  const [newStartDate, setNewStartDate] = useState('')

  function addScenario() {
    if (!newName.trim() || newSalary <= 0 || !newStartDate) return
    const colorIndex = scenarios.length % SCENARIO_COLORS.length
    const newScenario = {
      id: Date.now(),
      name: newName.trim(),
      monthlyTakeHome: newSalary,
      startDate: newStartDate,
      color: SCENARIO_COLORS[colorIndex],
    }
    onChange([...scenarios, newScenario])
    setNewName('')
    setNewSalary(0)
    setNewStartDate('')
  }

  function removeScenario(id) {
    onChange(scenarios.filter(s => s.id !== id))
  }

  function updateScenario(id, field, value) {
    onChange(scenarios.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const baselineResult = scenarioResults?.['__baseline__']

  return (
    <div className="space-y-5">
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Compare multiple job offers side-by-side. See how each role impacts your savings over time.
      </p>

      {/* Existing scenario cards */}
      {scenarios.map(s => {
        const result = scenarioResults?.[s.id]
        const annualEstimate = s.monthlyTakeHome * 12
        return (
          <div
            key={s.id}
            className="rounded-lg border p-4 space-y-3"
            style={{ borderColor: s.color + '40', background: s.color + '08' }}
          >
            {/* Header row */}
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: s.color }}
              />
              <input
                type="text"
                value={s.name}
                onChange={e => updateScenario(s.id, 'name', e.target.value)}
                className="flex-1 text-sm font-semibold bg-transparent border-none outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              <button
                onClick={() => removeScenario(s.id)}
                className="text-xs px-2 py-1 rounded border transition-colors"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
                title="Remove scenario"
              >
                &times;
              </button>
            </div>

            {/* Salary + date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Monthly take-home</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                  <CurrencyInput
                    value={s.monthlyTakeHome}
                    onChange={v => updateScenario(s.id, 'monthlyTakeHome', v)}
                    className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  {formatCurrency(annualEstimate)}/yr
                </p>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Start date</label>
                <input
                  type="date"
                  min={minDate}
                  value={s.startDate}
                  onChange={e => updateScenario(s.id, 'startDate', e.target.value)}
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                />
                {/* Quick pick buttons */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[1, 2, 3, 6].map(mo => {
                    const d = today.add(mo, 'month').format('YYYY-MM-DD')
                    return (
                      <button
                        key={mo}
                        onClick={() => updateScenario(s.id, 'startDate', d)}
                        className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                        style={{
                          borderColor: s.startDate === d ? s.color : 'var(--border-subtle)',
                          background: s.startDate === d ? s.color + '20' : 'transparent',
                          color: s.startDate === d ? s.color : 'var(--text-faint)',
                        }}
                      >
                        +{mo}mo
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Retirement contribution */}
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
                Retirement Contribution %
              </label>
              <input
                type="number"
                min="0"
                max="25"
                step="0.5"
                value={s.retirementContributionPct || 0}
                onChange={e => {
                  const val = Math.max(0, Math.min(25, Number(e.target.value) || 0))
                  updateScenario(s.id, 'retirementContributionPct', val)
                }}
                className="w-32 text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                {formatCurrency((s.monthlyTakeHome * (s.retirementContributionPct || 0)) / 100)}/mo to 401(k)/IRA
              </p>
            </div>

            {/* Quick metrics */}
            {result && (
              <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>
                  Runway: <strong style={{ color: 'var(--text-primary)' }}>
                    {result.runoutDate ? formatMonths(result.totalRunwayMonths) : 'Beyond 10 yrs'}
                  </strong>
                </span>
                <span>
                  {(() => {
                    const retirementAmount = (s.monthlyTakeHome * (s.retirementContributionPct || 0)) / 100
                    const effectiveTakeHome = s.monthlyTakeHome - retirementAmount
                    const surplus = effectiveTakeHome - result.effectiveExpenses
                    return (
                      <>
                        Surplus after start: <strong style={{ color: effectiveTakeHome > result.effectiveExpenses ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                          {formatCurrency(surplus)}/mo
                        </strong>
                      </>
                    )
                  })()}
                </span>
              </div>
            )}
          </div>
        )
      })}

      {/* Add new scenario form */}
      {scenarios.length < MAX_SCENARIOS ? (
        <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Add a scenario</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Company A - Sr Dev"
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Monthly take-home ($)</label>
              <CurrencyInput
                value={newSalary}
                onChange={setNewSalary}
                placeholder="e.g. 7,500"
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Start date</label>
              <input
                type="date"
                min={minDate}
                value={newStartDate}
                onChange={e => setNewStartDate(e.target.value)}
                className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
          <button
            onClick={addScenario}
            disabled={!newName.trim() || newSalary <= 0 || !newStartDate}
            className="text-xs px-4 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderColor: 'var(--accent-emerald)',
              background: 'var(--accent-emerald)' + '18',
              color: 'var(--accent-emerald)',
            }}
          >
            + Add Scenario
          </button>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Maximum of {MAX_SCENARIOS} scenarios reached. Remove one to add another.
        </p>
      )}

      {/* Chart */}
      {scenarios.length > 0 && scenarioResults && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Savings Projection
          </p>
          <JobScenariosChart scenarios={scenarios} scenarioResults={scenarioResults} />
        </div>
      )}

      {/* Comparison metrics table */}
      {scenarios.length > 0 && scenarioResults && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Scenario Comparison
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Baseline card */}
            {baselineResult && (
              <div className="rounded-lg border px-3 py-3 space-y-1.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>No Job (Baseline)</p>
                </div>
                <MetricRow label="Runway" value={baselineResult.runoutDate ? formatMonths(baselineResult.totalRunwayMonths) : 'Beyond 10 yrs'} />
                <MetricRow label="6 Months" value={formatCurrency(baselineResult.dataPoints[6]?.balance ?? 0)} />
                <MetricRow label="Year 1" value={formatCurrency(baselineResult.dataPoints[12]?.balance ?? 0)} />
                <MetricRow label="Year 2" value={formatCurrency(baselineResult.dataPoints[24]?.balance ?? 0)} />
              </div>
            )}

            {/* Scenario cards */}
            {scenarios.map(s => {
              const result = scenarioResults[s.id]
              if (!result) return null
              const surplus = s.monthlyTakeHome - result.effectiveExpenses
              return (
                <div
                  key={s.id}
                  className="rounded-lg border px-3 py-3 space-y-1.5"
                  style={{ borderColor: s.color + '40', background: s.color + '08' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <p className="text-xs font-semibold truncate" style={{ color: s.color }}>{s.name}</p>
                  </div>
                  <MetricRow label="Runway" value={result.runoutDate ? formatMonths(result.totalRunwayMonths) : 'Beyond 10 yrs'} />
                  <MetricRow label="6 Months" value={formatCurrency(result.dataPoints[6]?.balance ?? 0)} />
                  <MetricRow label="Year 1" value={formatCurrency(result.dataPoints[12]?.balance ?? 0)} />
                  <MetricRow label="Year 2" value={formatCurrency(result.dataPoints[24]?.balance ?? 0)} />
                  <MetricRow
                    label="Monthly surplus"
                    value={formatCurrency(surplus) + '/mo'}
                    valueColor={surplus >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {scenarios.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-faint)' }}>
          Add a job scenario above to see how different offers impact your financial runway.
        </p>
      )}
    </div>
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
