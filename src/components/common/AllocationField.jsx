import { formatCurrency } from '../../utils/formatters'

/**
 * AllocationField — shared dollar/percent toggle input for savings and investment
 * allocations in job scenario forms.
 *
 * Prop API (unified):
 *   label          {string}   Field label text
 *   value          {number}   Raw numeric input value (dollars or percent)
 *   type           {string}   'dollar' | 'percent'
 *   onValueChange  {function} Called with new numeric value
 *   onTypeChange   {function} Called with new type string ('dollar' | 'percent')
 *   color          {string}   Accent hex color for active toggle state
 *   resolvedAmount {number}   [optional] Pre-computed dollar amount for percent display.
 *                             If omitted, computed from takeHome.
 *   takeHome       {number}   [optional] Monthly take-home used to derive resolvedAmount
 *                             when resolvedAmount is not provided.
 *
 * Either `resolvedAmount` or `takeHome` must be supplied for the percent hint to display.
 */
export default function AllocationField({
  label,
  value,
  type,
  onValueChange,
  onTypeChange,
  color,
  resolvedAmount,
  takeHome,
}) {
  // Derive the resolved dollar amount from whichever prop was supplied
  const displayAmount =
    resolvedAmount !== undefined
      ? resolvedAmount
      : takeHome !== undefined
        ? (type === 'percent' ? (takeHome * value) / 100 : value)
        : undefined

  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        {type === 'dollar' && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            $
          </span>
        )}
        <input
          type="number"
          min="0"
          step={type === 'percent' ? 1 : 50}
          max={type === 'percent' ? 100 : undefined}
          value={value}
          onChange={e => onValueChange(Number(e.target.value))}
          className="flex-1 text-sm rounded px-2 py-1.5 focus:outline-none"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
        {type === 'percent' && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            %
          </span>
        )}
        {/* Dollar / Percent toggle pill */}
        <div
          className="flex rounded-md overflow-hidden border"
          style={{ borderColor: 'var(--border-default)' }}
        >
          <button
            type="button"
            onClick={() => onTypeChange('dollar')}
            className="text-xs px-2 py-1 transition-colors"
            style={{
              background: type === 'dollar' ? color + '30' : 'var(--bg-input)',
              color: type === 'dollar' ? color : 'var(--text-faint)',
            }}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => onTypeChange('percent')}
            className="text-xs px-2 py-1 transition-colors"
            style={{
              background: type === 'percent' ? color + '30' : 'var(--bg-input)',
              color: type === 'percent' ? color : 'var(--text-faint)',
            }}
          >
            %
          </button>
        </div>
      </div>
      {type === 'percent' && value > 0 && displayAmount !== undefined && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
          = {formatCurrency(displayAmount)}/mo
        </p>
      )}
    </div>
  )
}
