import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import CurrencyInput from './CurrencyInput'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function InvestmentsPanel({ investments, onChange, people = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(investments, onChange)

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
      {investments.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">
          No investments yet. Add things like 401k contributions, brokerage deposits, crypto DCA, or Roth IRA.
        </p>
      ) : (
        <>
        {/* Column headers — desktop only */}
        <div
          className="hidden sm:grid items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-semibold px-1"
          style={{ gridTemplateColumns: '20px 1fr 120px 72px 32px 32px 32px' }}
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
                  className="text-gray-600 hover:text-gray-400 transition-colors flex items-center justify-center select-none flex-shrink-0"
                  {...dragHandleProps(inv.id)}
                >
                  <DragHandle />
                </div>
                <input
                  type="text"
                  value={inv.name}
                  onChange={e => update(inv.id, 'name', e.target.value)}
                  className={`flex-1 min-w-0 bg-gray-700 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none transition-colors ${
                    inv.active ? 'border-teal-700/50 focus:border-teal-400' : 'border-gray-600 focus:border-gray-500'
                  }`}
                  placeholder="e.g. Roth IRA, 401k, BTC DCA"
                />
              </div>
              {/* Subrow 2: monthly · status · assignee · trash */}
              <div className="flex items-center gap-2 sm:contents">
                <div className={`flex-1 sm:flex-none flex items-center bg-gray-700 border rounded-lg px-2 py-2 transition-colors ${
                  inv.active ? 'border-teal-700/50 focus-within:border-teal-400' : 'border-gray-600 focus-within:border-gray-500'
                }`}>
                  <span className="text-gray-500 text-sm mr-1">$</span>
                  <CurrencyInput
                    value={inv.monthlyAmount}
                    onChange={val => update(inv.id, 'monthlyAmount', val)}
                    className="bg-transparent text-white text-sm w-full outline-none"
                    min="0"
                  />
                  <span className="text-gray-600 text-xs ml-1 shrink-0">/mo</span>
                </div>
                <button
                  onClick={() => update(inv.id, 'active', !inv.active)}
                  title={inv.active ? 'Pause this investment' : 'Resume this investment'}
                  className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 relative overflow-hidden ${
                    inv.active ? 'bg-teal-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      inv.active ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
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
                  className="text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center"
                  title="Remove investment"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          )})}

        </div>
        </>
      )}

      <button
        onClick={add}
        className="w-full py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-teal-500 hover:text-teal-400 text-sm transition-colors"
      >
        + Add Investment
      </button>

      {investments.length > 0 && (
        <div className="bg-gray-700/40 rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Active monthly: </span>
            <span className="text-teal-300 font-semibold">{formatCurrency(activeTotal)}/mo</span>
          </div>
          {pausedTotal > 0 && (
            <div>
              <span className="text-gray-500">Paused: </span>
              <span className="text-gray-400 font-semibold">{formatCurrency(pausedTotal)}/mo</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-600">
        Active investments add to your monthly burn — toggle <span className="text-teal-400 font-medium">Off</span> to pause. Drag <span className="text-gray-500">⠿</span> to reorder.
      </p>
    </div>
  )
}
