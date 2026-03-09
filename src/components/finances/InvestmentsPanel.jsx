import { useState, useEffect } from 'react'
import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { useDragReorder } from '../../hooks/useDragReorder'
import { useSnapTrade } from '../../hooks/useSnapTrade'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import CurrencyInput from './CurrencyInput'
import SnapTradeConnectButton from '../snaptrade/SnapTradeConnectButton'
import SnapTradeAccountsPanel from '../snaptrade/SnapTradeAccountsPanel'
import { SkeletonLine, SkeletonStyles } from '../common/Skeleton'

function InvestmentsPanelSkeleton() {
  return (
    <div className="space-y-3" data-testid="investments-panel-skeleton">
      <SkeletonStyles />
      {/* SnapTrade section placeholder */}
      <div className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonLine width="8rem" height="0.75rem" />
            <SkeletonLine width="12rem" height="0.6rem" />
          </div>
          <SkeletonLine width="5rem" height="2rem" style={{ borderRadius: '0.5rem' }} />
        </div>
      </div>
      {/* Manual investments placeholder */}
      {[1, 2].map(i => (
        <div key={i} className="flex items-center gap-3 py-1">
          <SkeletonLine width="1rem" height="1rem" style={{ borderRadius: '0.25rem', flexShrink: 0 }} />
          <SkeletonLine height="2.25rem" style={{ borderRadius: '0.5rem', flex: 1 }} />
          <SkeletonLine width="7rem" height="2.25rem" style={{ borderRadius: '0.5rem', flexShrink: 0 }} />
          <SkeletonLine width="2rem" height="1.25rem" style={{ borderRadius: '0.75rem', flexShrink: 0 }} />
        </div>
      ))}
      <SkeletonLine width="100%" height="2.25rem" style={{ borderRadius: '0.5rem' }} />
    </div>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function InvestmentsPanel({ investments, onChange, people = [], filterPersonId = null, loading = false }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(investments, onChange)
  const snapTrade = useSnapTrade()
  const [snapTradeLoaded, setSnapTradeLoaded] = useState(false)

  useEffect(() => {
    if (!snapTradeLoaded) {
      snapTrade.fetchAccounts().then(() => setSnapTradeLoaded(true))
    }
  }, [snapTradeLoaded])

  if (loading || (snapTrade.loading && !snapTradeLoaded)) return <InvestmentsPanelSkeleton />

  function update(id, field, val) {
    onChange(investments.map(inv => inv.id === id ? { ...inv, [field]: val } : inv))
  }

  function remove(id) {
    onChange(investments.filter(inv => inv.id !== id))
  }

  function add() {
    onChange([
      ...investments,
      { id: Date.now(), name: 'New Investment', description: '', monthlyAmount: 0, active: true, assignedTo: null },
    ])
  }

  const activeTotal = investments
    .filter(inv => inv.active)
    .reduce((sum, inv) => sum + (Number(inv.monthlyAmount) || 0), 0)

  const pausedTotal = investments
    .filter(inv => !inv.active)
    .reduce((sum, inv) => sum + (Number(inv.monthlyAmount) || 0), 0)

  return (
    <div className="space-y-3">
      {/* SnapTrade — Connected Brokerage Accounts */}
      {snapTrade.connections.length > 0 ? (
        <SnapTradeAccountsPanel
          accounts={snapTrade.connections}
          syncing={snapTrade.syncing}
          lastSync={snapTrade.lastSync}
          onSync={() => snapTrade.syncAll()}
          onDisconnect={(id) => snapTrade.disconnect(id)}
        />
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Connect Brokerage</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Link Fidelity or other investment accounts via SnapTrade
              </div>
            </div>
            <SnapTradeConnectButton
              generateConnectUrl={snapTrade.connect}
              loading={snapTrade.loading}
              onConnect={() => snapTrade.fetchAccounts()}
            />
          </div>
          {snapTrade.error && (
            <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>{snapTrade.error}</p>
          )}
        </div>
      )}

      {/* Manual Investments */}
      {investments.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No investments yet. Add things like 401k contributions, brokerage deposits, crypto DCA, or Roth IRA.
        </p>
      ) : (
        <>
        {/* Column headers — desktop only */}
        <div
          className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
          style={{ gridTemplateColumns: '20px 1fr 120px 72px 32px 32px 32px', color: 'var(--text-secondary)' }}
        >
          <span></span>
          <span>Investment</span>
          <span>Monthly</span>
          <span className="text-center">Status</span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="space-y-2">
          {investments.map(inv => {
            const dimmed = filterPersonId && !matchesPersonFilter(inv.assignedTo, filterPersonId)
            return (
            <div
              key={inv.id}
              className={`row-invest-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                !inv.active ? 'opacity-50' : ''
              } ${draggingId === inv.id ? 'opacity-40' : ''} ${
                overedId === inv.id && draggingId !== inv.id ? 'ring-2 ring-teal-500/50 ring-inset' : ''
              } ${dimmed ? 'opacity-25' : ''}`}
              {...getItemProps(inv.id)}
            >
              {/* Subrow 1: drag · name */}
              <div className="flex items-center gap-2 sm:contents">
                <div
                  className="transition-colors flex items-center justify-center select-none flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  {...dragHandleProps(inv.id)}
                >
                  <DragHandle />
                </div>
                <input
                  type="text"
                  value={inv.name}
                  onChange={e => update(inv.id, 'name', e.target.value)}
                  className={`flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
                    inv.active ? 'border-teal-700/50 focus:border-teal-400' : ''
                  }`}
                  style={inv.active ? {
                    background: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                  } : {
                    background: 'var(--bg-page)',
                    border: '1px solid var(--border-input)',
                    color: 'var(--text-primary)',
                  }}
                  placeholder="e.g. Roth IRA, 401k, BTC DCA"
                />
              </div>
              {/* Subrow 2: monthly · status · assignee · trash */}
              <div className="flex items-center gap-2 sm:contents">
                <div
                  className={`flex-1 sm:flex-none flex items-center rounded-lg px-2 py-2 transition-colors ${
                    inv.active ? 'border-teal-700/50 focus-within:border-teal-400' : ''
                  }`}
                  style={inv.active ? {
                    background: 'var(--bg-page)',
                  } : {
                    background: 'var(--bg-page)',
                    border: '1px solid var(--border-input)',
                  }}
                >
                  <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                  <CurrencyInput
                    value={inv.monthlyAmount}
                    onChange={val => update(inv.id, 'monthlyAmount', val)}
                    className="bg-transparent text-sm w-full outline-none"
                    style={{ color: 'var(--text-primary)' }}
                    min="0"
                  />
                  <span className="text-xs ml-1 shrink-0" style={{ color: 'var(--text-faint)' }}>/mo</span>
                </div>
                <button
                  type="button"
                  onClick={() => update(inv.id, 'active', !inv.active)}
                  title={inv.active ? 'Pause this investment' : 'Resume this investment'}
                  className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer p-0.5 ${
                    inv.active ? 'bg-teal-500' : ''
                  }`}
                  style={!inv.active ? { backgroundColor: 'var(--bg-input)' } : {}}
                >
                  <span
                    className={`block w-4 h-4 rounded-full shadow transition-transform ${
                      inv.active ? 'translate-x-3' : 'translate-x-0'
                    }`}
                    style={{ backgroundColor: 'var(--text-primary)' }}
                  />
                </button>
                <AssigneeSelect
                  people={people}
                  value={inv.assignedTo ?? null}
                  onChange={val => update(inv.id, 'assignedTo', val)}
                />
                <CommentButton itemId={`inv_${inv.id}`} label={inv.name || 'Investment'} />
                <button
                  onClick={() => remove(inv.id)}
                  className="transition-colors flex items-center justify-center"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  title="Remove investment"
                >
                  <TrashIcon />
                </button>
              </div>
              {/* Subrow 3: description / notes */}
              <div className="sm:col-span-7">
                <input
                  type="text"
                  value={inv.description || ''}
                  onChange={e => update(inv.id, 'description', e.target.value)}
                  className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500/60"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                  placeholder="Add a note..."
                />
              </div>
            </div>
          )})}

        </div>
        </>
      )}

      <button
        onClick={add}
        className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#14b8a6'
          e.currentTarget.style.color = '#2dd4bf'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        + Add Investment
      </button>

      {investments.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Active monthly: </span>
            <span className="text-teal-300 font-semibold sensitive">{formatCurrency(activeTotal)}/mo</span>
          </div>
          {pausedTotal > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Paused: </span>
              <span className="font-semibold sensitive" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(pausedTotal)}/mo</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Active investments add to your monthly burn — toggle <span className="text-teal-400 font-medium">Off</span> to pause. Drag <span style={{ color: 'var(--text-muted)' }}>⠿</span> to reorder.
      </p>
    </div>
  )
}
