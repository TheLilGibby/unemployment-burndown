import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import dayjs from 'dayjs'
import AssigneeSelect from '../people/AssigneeSelect'

export default function UnemploymentPanel({ value, onChange, furloughDate, onFurloughDateChange, people = [], derivedStartDate = null, filterPersonId = null }) {
  function update(field, val) {
    onChange({ ...value, [field]: val })
  }

  const totalBenefits = (Number(value.weeklyAmount) || 0) * (Number(value.durationWeeks) || 0)
  const monthlyBenefits = (Number(value.weeklyAmount) || 0) * (52 / 12)
  const endDate = dayjs(value.startDate).add(Number(value.durationWeeks) || 0, 'week')

  const dimmed = filterPersonId && !matchesPersonFilter(value.assignedTo, filterPersonId)

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
        Tip: Check your state's unemployment website for exact weekly benefit amount. Most states have a 1-2 week waiting period.
      </p>
    </div>
  )
}
