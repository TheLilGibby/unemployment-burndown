import { formatCurrency, formatDate } from '../../utils/formatters'
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
          <label className="block text-xs text-gray-500 mb-1 font-medium">Simulation Start Date</label>
          <input
            type="date"
            value={furloughDate || ''}
            onChange={e => onFurloughDateChange(e.target.value)}
            className="w-full sm:w-48 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-600 mt-1">The date the burndown simulation starts from.</p>
          {derivedStartDate && !furloughDate && (
            <p className="text-xs mt-1" style={{ color: 'var(--accent-amber)' }}>
              Auto-derived from earliest job status change ({derivedStartDate}). Edit above to override.
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1 font-medium">Benefits Start Date</label>
          <input
            type="date"
            value={value.startDate}
            onChange={e => update('startDate', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1 font-medium">Weekly Benefit Amount</label>
          <div className="flex items-center bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus-within:border-blue-500">
            <span className="text-gray-400 mr-1 text-sm">$</span>
            <input
              type="number"
              value={value.weeklyAmount}
              onChange={e => update('weeklyAmount', Number(e.target.value))}
              className="bg-transparent text-white text-sm w-full outline-none"
              min="0"
              step="10"
            />
            <span className="text-gray-500 text-xs ml-1">/wk</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1 font-medium">Duration (weeks)</label>
          <div className="flex items-center bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus-within:border-blue-500">
            <input
              type="number"
              value={value.durationWeeks}
              onChange={e => update('durationWeeks', Number(e.target.value))}
              className="bg-transparent text-white text-sm w-full outline-none"
              min="1"
              max="99"
            />
            <span className="text-gray-500 text-xs ml-1">wks</span>
          </div>
        </div>
      </div>

      {/* Recipient */}
      {people.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500 mb-1 font-medium">Benefits Recipient</label>
          <AssigneeSelect
            people={people}
            value={value.assignedTo ?? null}
            onChange={val => onChange({ ...value, assignedTo: val })}
          />
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-700/40 rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-gray-500">Total benefits: </span>
          <span className="text-white font-semibold sensitive">{formatCurrency(totalBenefits)}</span>
        </div>
        <div>
          <span className="text-gray-500">Monthly equiv: </span>
          <span className="text-white font-semibold sensitive">{formatCurrency(monthlyBenefits)}/mo</span>
        </div>
        <div>
          <span className="text-gray-500">Benefits end: </span>
          <span className="text-white font-semibold">{endDate.format('MMM D, YYYY')}</span>
        </div>
      </div>

      <p className="text-xs text-gray-600">
        Tip: Check your state's unemployment website for exact weekly benefit amount. Most states have a 1-2 week waiting period.
      </p>
    </div>
  )
}
