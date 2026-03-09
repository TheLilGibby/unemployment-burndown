import { formatMonths } from '../../utils/formatters'
import dayjs from 'dayjs'

export default function ExpenseFreezeDatePanel({ value, onChange, baseRunwayMonths, altRunwayMonths }) {
  const freezeDate = value.freezeDate || ''
  const reductionPct = Number(value.expenseReductionPct) || 0

  function setFreezeDate(d) {
    onChange({ ...value, freezeDate: d })
  }

  const delta =
    altRunwayMonths != null && baseRunwayMonths != null
      ? altRunwayMonths - baseRunwayMonths
      : null

  const isActive = !!freezeDate && reductionPct > 0

  const today = dayjs()
  const monthsUntilFreeze = freezeDate
    ? Math.max(0, Math.round(dayjs(freezeDate).diff(today, 'day') / 30))
    : 0
  const minDate = today.add(1, 'day').format('YYYY-MM-DD')

  return (
    <div className="space-y-3 pt-2">
      {reductionPct === 0 && (
        <div className="text-[10px] text-amber-400 bg-amber-900/15 border border-amber-700/20 rounded px-2.5 py-1.5">
          Set expense cut % in Basics first — freeze controls <em>when</em> that cut begins.
        </div>
      )}

      {/* Date + quick picks */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <label className="text-xs text-gray-400 shrink-0">Full spend until</label>
          <input
            type="date" min={minDate}
            value={freezeDate}
            onChange={e => setFreezeDate(e.target.value)}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 6].map(mo => {
            const d = today.add(mo, 'month').format('YYYY-MM-DD')
            return (
              <button
                key={mo}
                onClick={() => setFreezeDate(d)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  freezeDate === d
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-700/60 border-gray-600 text-gray-400 hover:border-blue-500'
                }`}
              >
                +{mo}mo
              </button>
            )
          })}
          {freezeDate && (
            <button
              onClick={() => setFreezeDate('')}
              className="text-[10px] px-2 py-0.5 rounded-full border border-gray-600 text-gray-500 hover:border-red-500 hover:text-red-400 transition-colors"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Compact impact */}
      {isActive && (
        <div className={`rounded-lg px-3 py-2 text-xs border ${
          delta > 0 ? 'bg-emerald-950/20 border-emerald-700/30'
          : delta < 0 ? 'bg-red-950/20 border-red-700/30'
          : 'bg-gray-800/40 border-gray-700/40'
        }`}>
          <div className="flex items-center justify-between text-gray-400">
            <span>~{monthsUntilFreeze}mo normal spend, then -{reductionPct}%</span>
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
