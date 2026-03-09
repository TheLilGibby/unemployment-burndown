import { useState } from 'react'
import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { STATE_UNEMPLOYMENT_DATA, getStateByCode } from '../../constants/stateUnemploymentData'
import dayjs from 'dayjs'
import AssigneeSelect from '../people/AssigneeSelect'

export default function UnemploymentPanel({ value, onChange, furloughDate, onFurloughDateChange, people = [], derivedStartDate = null, filterPersonId = null }) {
  const [selectedState, setSelectedState] = useState(value.stateCode || '')

  function update(field, val) {
    onChange({ ...value, [field]: val })
  }

  function handleStateChange(stateCode) {
    setSelectedState(stateCode)
    if (!stateCode) {
      onChange({ ...value, stateCode: '' })
      return
    }
    const state = getStateByCode(stateCode)
    if (state) {
      onChange({
        ...value,
        stateCode,
        weeklyAmount: state.maxWeeklyBenefit,
        durationWeeks: state.maxWeeks,
      })
    }
  }

  const totalBenefits = (Number(value.weeklyAmount) || 0) * (Number(value.durationWeeks) || 0)
  const monthlyBenefits = (Number(value.weeklyAmount) || 0) * (52 / 12)
  const endDate = dayjs(value.startDate).add(Number(value.durationWeeks) || 0, 'week')

  const dimmed = filterPersonId && !matchesPersonFilter(value.assignedTo, filterPersonId)

  const stateInfo = selectedState ? getStateByCode(selectedState) : null

  return (
    <div className={`space-y-4 transition-opacity ${dimmed ? 'opacity-25' : ''}`}>
      {onFurloughDateChange && (
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Simulation Start Date</label>
          <input
            type="date"
            value={furloughDate || ''}
            onChange={e => onFurloughDateChange(e.target.value)}
            className="w-full sm:w-48 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>The date the burndown simulation starts from.</p>
          {derivedStartDate && !furloughDate && (
            <p className="text-xs mt-1" style={{ color: 'var(--accent-amber)' }}>
              Auto-derived from earliest job status change ({derivedStartDate}). Edit above to override.
            </p>
          )}
        </div>
      )}

      {/* State lookup */}
      <div>
        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Look Up Your State</label>
        <select
          value={selectedState}
          onChange={e => handleStateChange(e.target.value)}
          className="w-full sm:w-64 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
          style={{
            background: 'var(--bg-page)',
            border: '1px solid var(--border-input)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">Select your state...</option>
          {STATE_UNEMPLOYMENT_DATA.map(s => (
            <option key={s.stateCode} value={s.stateCode}>
              {s.stateName}
            </option>
          ))}
        </select>
        <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
          Auto-fills max weekly benefit and duration. You can override below with your actual approved amounts.
        </p>
      </div>

      {/* State benefit info card */}
      {stateInfo && (
        <div
          className="rounded-lg px-4 py-3 text-sm space-y-2"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {stateInfo.stateName} Unemployment Benefits
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div>Max weekly: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(stateInfo.maxWeeklyBenefit)}</span></div>
            <div>Max duration: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {stateInfo.maxWeeks} weeks{stateInfo.maxWeeksRange ? ` (range: ${stateInfo.maxWeeksRange})` : ''}
            </span></div>
            <div>Waiting period: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{stateInfo.waitingPeriod.description}</span></div>
            <div>Calculation: <span style={{ color: 'var(--text-primary)' }}>{stateInfo.calculationMethod}</span></div>
          </div>
          <a
            href={stateInfo.filingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs underline mt-1"
            style={{ color: 'var(--accent-blue)' }}
          >
            File on {stateInfo.stateName} DOL website
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Benefits Start Date</label>
          <input
            type="date"
            value={value.startDate}
            onChange={e => update('startDate', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Weekly Benefit Amount</label>
          <div
            className="flex items-center rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
            }}
          >
            <span className="mr-1 text-sm" style={{ color: 'var(--text-secondary)' }}>$</span>
            <input
              type="number"
              value={value.weeklyAmount}
              onChange={e => update('weeklyAmount', Number(e.target.value))}
              className="bg-transparent text-sm w-full outline-none"
              style={{ color: 'var(--text-primary)' }}
              min="0"
              step="10"
            />
            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>/wk</span>
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Duration (weeks)</label>
          <div
            className="flex items-center rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
            }}
          >
            <input
              type="number"
              value={value.durationWeeks}
              onChange={e => update('durationWeeks', Number(e.target.value))}
              className="bg-transparent text-sm w-full outline-none"
              style={{ color: 'var(--text-primary)' }}
              min="1"
              max="99"
            />
            <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>wks</span>
          </div>
        </div>
      </div>

      {/* Recipient */}
      {people.length > 0 && (
        <div>
          <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Benefits Recipient</label>
          <AssigneeSelect
            people={people}
            value={value.assignedTo ?? null}
            onChange={val => onChange({ ...value, assignedTo: val })}
          />
        </div>
      )}

      {/* Summary */}
      <div
        className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Total benefits: </span>
          <span className="font-semibold sensitive" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalBenefits)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Monthly equiv: </span>
          <span className="font-semibold sensitive" style={{ color: 'var(--text-primary)' }}>{formatCurrency(monthlyBenefits)}/mo</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Benefits end: </span>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{endDate.format('MMM D, YYYY')}</span>
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        {selectedState
          ? 'Values auto-filled from state data. Override with your actual approved amounts for best accuracy.'
          : 'Tip: Select your state above to auto-fill benefit estimates, or check your state\'s unemployment website for exact amounts.'}
      </p>
    </div>
  )
}
