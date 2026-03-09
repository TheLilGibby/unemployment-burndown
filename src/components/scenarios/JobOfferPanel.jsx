import { formatCurrency, formatMonths } from '../../utils/formatters'
import dayjs from 'dayjs'

export default function JobOfferPanel({ value, onChange, baseRunwayMonths, altRunwayMonths }) {
  const salary   = Number(value.jobOfferSalary)    || 0
  const startDate = value.jobOfferStartDate || ''

  function update(field, val) {
    onChange({ ...value, [field]: val })
  }

  const delta =
    altRunwayMonths != null && baseRunwayMonths != null
      ? altRunwayMonths - baseRunwayMonths
      : null

  const isActive = salary > 0 && !!startDate

  const today = dayjs()
  const minDate = today.add(1, 'day').format('YYYY-MM-DD')

  const monthsUntilStart = startDate
    ? Math.max(0, parseFloat(dayjs(startDate).diff(today, 'day') / 30).toFixed(1))
    : null

  return (
    <div className="space-y-3 pt-2">
      {/* Salary — inline slider + editable value */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <label className="text-xs text-gray-400 shrink-0">Take-home</label>
          <input
            type="range" min="0" max="15000" step="250"
            value={salary}
            onChange={e => update('jobOfferSalary', Number(e.target.value))}
            className="flex-1 h-1.5 accent-emerald-500 cursor-pointer"
          />
          <input
            type="number" min="0" step="100"
            value={salary || ''}
            placeholder="$0"
            onChange={e => update('jobOfferSalary', Math.max(0, Number(e.target.value)))}
            className="w-20 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-emerald-400 font-bold text-right focus:outline-none focus:border-emerald-500"
          />
          <span className="text-xs text-gray-500">/mo</span>
        </div>
        {salary > 0 && (
          <p className="text-[10px] text-gray-600 text-right">
            {formatCurrency(salary * 12)}/yr
          </p>
        )}
      </div>

      {/* Start date + quick picks — single row */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <label className="text-xs text-gray-400 shrink-0">Start date</label>
          <input
            type="date" min={minDate}
            value={startDate}
            onChange={e => update('jobOfferStartDate', e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 6].map(mo => {
            const d = today.add(mo, 'month').format('YYYY-MM-DD')
            return (
              <button
                key={mo}
                onClick={() => update('jobOfferStartDate', d)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  startDate === d
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-gray-700/60 border-gray-600 text-gray-400 hover:border-emerald-500'
                }`}
              >
                +{mo}mo
              </button>
            )
          })}
          {(salary > 0 || startDate) && (
            <button
              onClick={() => onChange({ ...value, jobOfferSalary: 0, jobOfferStartDate: '' })}
              className="text-[10px] px-2 py-0.5 rounded-full border border-gray-600 text-gray-500 hover:border-red-500 hover:text-red-400 transition-colors"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Compact summary + impact merged */}
      {isActive && (
        <div className={`rounded-lg px-3 py-2 text-xs border ${
          delta > 0
            ? 'bg-emerald-950/30 border-emerald-700/30'
            : delta < 0
            ? 'bg-red-950/30 border-red-700/30'
            : 'bg-gray-800/40 border-gray-700/40'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-400">
              Starts in ~{monthsUntilStart}mo at {formatCurrency(salary)}/mo
            </span>
            {delta !== null && delta !== 0 && (
              <span className={`font-bold whitespace-nowrap ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {delta > 0 ? '+' : ''}{formatMonths(Math.abs(delta))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
