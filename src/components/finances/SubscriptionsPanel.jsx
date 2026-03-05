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

export default function SubscriptionsPanel({ subscriptions, onChange, people = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(subscriptions, onChange)

  function updateSub(id, field, val) {
    onChange(subscriptions.map(s => s.id === id ? { ...s, [field]: val } : s))
  }

  function toggleSub(id) {
    onChange(subscriptions.map(s => s.id === id ? { ...s, active: s.active === false ? true : false } : s))
  }

  function deleteSub(id) {
    onChange(subscriptions.filter(s => s.id !== id))
  }

  function addSub() {
    onChange([...subscriptions, { id: Date.now(), name: 'New Subscription', monthlyAmount: 0, active: true, assignedTo: null, description: '' }])
  }

  const activeTotal = subscriptions
    .filter(s => s.active !== false)
    .reduce((sum, s) => sum + (Number(s.monthlyAmount) || 0), 0)

  const inactiveTotal = subscriptions
    .filter(s => s.active === false)
    .reduce((sum, s) => sum + (Number(s.monthlyAmount) || 0), 0)

  return (
    <div className="space-y-3">
      {/* Column headers — desktop only */}
      <div
        className="hidden sm:grid items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-semibold px-1"
        style={{ gridTemplateColumns: '20px 32px 1fr 130px 32px 32px 32px' }}
      >
        <span></span>
        <span></span>
        <span>Service / Name</span>
        <span>Monthly Cost</span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      {/* Subscription rows */}
      <div className="space-y-2">
        {subscriptions.map(sub => {
          const isActive = sub.active !== false
          const dimmed = filterPersonId && !matchesPersonFilter(sub.assignedTo, filterPersonId)
          return (
            <div
              key={sub.id}
              className={`row-savings-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                draggingId === sub.id ? 'opacity-40' : ''
              } ${
                overedId === sub.id && draggingId !== sub.id
                  ? 'ring-2 ring-blue-500/50 ring-inset'
                  : ''
              } ${!isActive ? 'opacity-50' : ''} ${dimmed ? 'opacity-25' : ''}`}
              {...getItemProps(sub.id)}
            >
              {/* Subrow 1: drag · toggle · name */}
              <div className="flex items-center gap-2 sm:contents">
                <div
                  className="text-gray-600 hover:text-gray-400 transition-colors flex items-center justify-center select-none flex-shrink-0"
                  {...dragHandleProps(sub.id)}
                >
                  <DragHandle />
                </div>
                <button
                  onClick={() => toggleSub(sub.id)}
                  title={isActive ? 'Pause subscription' : 'Include subscription'}
                  className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 relative overflow-hidden ${
                    isActive ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      isActive ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <input
                  type="text"
                  value={sub.name}
                  onChange={e => updateSub(sub.id, 'name', e.target.value)}
                  className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Netflix"
                />
              </div>
              {/* Subrow 2: amount · assignee · trash */}
              <div className="flex items-center gap-2 sm:contents">
                <div className="flex-1 sm:flex-none flex items-center bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 focus-within:border-blue-500">
                  <span className="text-gray-500 text-sm mr-1">$</span>
                  <CurrencyInput
                    value={sub.monthlyAmount}
                    onChange={val => updateSub(sub.id, 'monthlyAmount', val)}
                    className="bg-transparent text-white text-sm w-full outline-none"
                    min="0"
                  />
                </div>
                <AssigneeSelect
                  people={people}
                  value={sub.assignedTo ?? null}
                  onChange={val => updateSub(sub.id, 'assignedTo', val)}
                />
                <CommentButton itemId={`sub_${sub.id}`} label={sub.name || 'Subscription'} />
                <button
                  onClick={() => deleteSub(sub.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center flex-shrink-0"
                  title="Remove subscription"
                >
                  <TrashIcon />
                </button>
              </div>
              {/* Subrow 3: description / notes */}
              <div className="sm:col-span-7">
                <input
                  type="text"
                  value={sub.description || ''}
                  onChange={e => updateSub(sub.id, 'description', e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-blue-500 placeholder-gray-600"
                  placeholder="Add a note..."
                />
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={addSub}
        className="w-full py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-blue-500 hover:text-blue-400 text-sm transition-colors"
      >
        + Add Subscription
      </button>

      <div className="bg-gray-700/40 rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-gray-500">Active: </span>
          <span className="text-white font-semibold">{formatCurrency(activeTotal)}/mo</span>
        </div>
        {inactiveTotal > 0 && (
          <div>
            <span className="text-gray-500">Paused: </span>
            <span className="text-gray-500 font-semibold line-through">{formatCurrency(inactiveTotal)}/mo</span>
          </div>
        )}
        {inactiveTotal > 0 && (
          <div>
            <span className="text-gray-500">Savings if cut: </span>
            <span className="text-emerald-400 font-semibold">+{formatCurrency(inactiveTotal)}/mo</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600">
        Toggle subscriptions on/off to see their impact on your runway. Drag <span className="text-gray-500">⠿</span> to reorder.
      </p>
    </div>
  )
}
