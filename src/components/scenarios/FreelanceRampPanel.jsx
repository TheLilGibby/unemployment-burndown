import { formatCurrency, formatMonths } from '../../utils/formatters'
import dayjs from 'dayjs'

const today = dayjs()

const DEFAULT_TIERS = [
  { monthOffset: 0, monthlyAmount: 0 },
  { monthOffset: 3, monthlyAmount: 0 },
  { monthOffset: 6, monthlyAmount: 0 },
]

export default function FreelanceRampPanel({ value, onChange, baseRunwayMonths, altRunwayMonths }) {
  const ramp = value.freelanceRamp && value.freelanceRamp.length > 0
    ? value.freelanceRamp
    : DEFAULT_TIERS

  function updateTier(idx, field, val) {
    const next = ramp.map((t, i) => i === idx ? { ...t, [field]: val } : t)
    onChange({ ...value, freelanceRamp: next })
  }

  function addTier() {
    const lastOffset = ramp[ramp.length - 1]?.monthOffset ?? 0
    onChange({
      ...value,
      freelanceRamp: [...ramp, { monthOffset: lastOffset + 3, monthlyAmount: 0 }],
    })
  }

  function removeTier(idx) {
    if (ramp.length <= 1) return
    onChange({ ...value, freelanceRamp: ramp.filter((_, i) => i !== idx) })
  }

  const delta =
    altRunwayMonths != null && baseRunwayMonths != null
      ? altRunwayMonths - baseRunwayMonths
      : null

  const isActive = ramp.some(t => (Number(t.monthlyAmount) || 0) > 0)

  return (
    <div className="space-y-2.5 pt-2">
      {/* Compact tier rows */}
      <div className="space-y-1.5">
        {ramp.map((tier, idx) => {
          const startDate = today.add(tier.monthOffset, 'month')
          return (
            <div key={idx} className="flex items-center gap-1.5 group">
              <span className="text-[10px] text-gray-500 w-10 text-right shrink-0">
                +{tier.monthOffset}mo
              </span>
              <input
                type="number" min="0" max="60" step="1"
                value={tier.monthOffset}
                onChange={e => updateTier(idx, 'monthOffset', Math.max(0, Number(e.target.value)))}
                className="w-10 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-[10px] text-white text-center focus:outline-none focus:border-teal-500"
              />
              <span className="text-gray-600 text-[10px]">→</span>
              <div className="flex items-center gap-0.5 flex-1">
                <span className="text-gray-500 text-[10px]">$</span>
                <input
                  type="number" min="0" step="100"
                  value={tier.monthlyAmount || ''}
                  placeholder="0"
                  onChange={e => updateTier(idx, 'monthlyAmount', Math.max(0, Number(e.target.value)))}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-teal-300 focus:outline-none focus:border-teal-500"
                />
              </div>
              <span className="text-[10px] text-gray-600 w-16 truncate">{startDate.format('MMM \'YY')}</span>
              {ramp.length > 1 && (
                <button
                  onClick={() => removeTier(idx)}
                  className="text-gray-700 hover:text-red-400 transition-colors text-xs leading-none opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={addTier}
        className="text-[10px] text-teal-400 hover:text-teal-300 border border-teal-700/30 hover:border-teal-500 px-2.5 py-1 rounded transition-colors w-full"
      >
        + Add phase
      </button>

      {/* Compact impact */}
      {isActive && delta !== null && delta !== 0 && (
        <div className={`rounded-lg px-3 py-2 text-xs border ${
          delta > 0
            ? 'bg-emerald-950/20 border-emerald-700/30'
            : 'bg-red-950/20 border-red-700/30'
        }`}>
          <div className="flex items-center justify-between text-gray-400">
            <span>Freelance ramp impact</span>
            <span className={`font-bold ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {delta > 0 ? '+' : ''}{formatMonths(Math.abs(delta))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
