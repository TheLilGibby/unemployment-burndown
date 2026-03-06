import { Link2 } from 'lucide-react'

export default function TransactionLinkButton({ overviewKey, overviewItem, linkedTransactions = [], allTransactions = [], onOpenLookup }) {
  // Only render when transaction data is available
  if (!allTransactions.length && linkedTransactions.length === 0) return null

  const count = linkedTransactions.length

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpenLookup(overviewKey, overviewItem) }}
      title={count > 0 ? `${count} linked transaction${count !== 1 ? 's' : ''} — click to manage` : 'Find matching transactions'}
      className="relative flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 transition-colors"
      style={{
        color: count > 0 ? 'var(--accent-blue)' : 'var(--text-muted)',
        background: count > 0 ? 'color-mix(in srgb, var(--accent-blue) 12%, transparent)' : 'transparent',
        border: count > 0 ? '1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent)' : '1px solid transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--accent-blue)'
        e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-blue) 15%, transparent)'
        e.currentTarget.style.border = '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = count > 0 ? 'var(--accent-blue)' : 'var(--text-muted)'
        e.currentTarget.style.background = count > 0 ? 'color-mix(in srgb, var(--accent-blue) 12%, transparent)' : 'transparent'
        e.currentTarget.style.border = count > 0 ? '1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent)' : '1px solid transparent'
      }}
    >
      <Link2 size={13} strokeWidth={1.7} />

      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 text-white font-bold rounded-full flex items-center justify-center tabular-nums"
          style={{
            fontSize: 9,
            lineHeight: 1,
            minWidth: 14,
            height: 14,
            padding: '0 3px',
            background: 'var(--accent-blue)',
          }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}
