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

export default function SavingsPanel({ accounts, onChange, people = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(accounts, onChange)

  function updateAccount(id, field, val) {
    onChange(accounts.map(a => a.id === id ? { ...a, [field]: val } : a))
  }

  function toggleAccount(id) {
    onChange(accounts.map(a => a.id === id ? { ...a, active: a.active === false ? true : false } : a))
  }

  function deleteAccount(id) {
    onChange(accounts.filter(a => a.id !== id))
  }

  function addAccount() {
    onChange([...accounts, { id: Date.now(), name: 'New Account', amount: 0, active: true, assignedTo: null, description: '' }])
  }

  const total = accounts
    .filter(a => a.active !== false)
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)

  return (
    <div className="space-y-3">
      {/* Column headers — desktop only */}
      <div
        className="hidden sm:grid items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-semibold px-1"
        style={{ gridTemplateColumns: '20px 32px 1fr 130px 32px 32px 32px' }}
      >
        <span></span>
        <span></span>
        <span>Account / Source</span>
        <span>Balance</span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      {/* Account rows */}
      <div className="space-y-2">
        {accounts.map(account => {
          const isActive = account.active !== false
          const dimmed = filterPersonId && !matchesPersonFilter(account.assignedTo, filterPersonId)
          return (
            <div
              key={account.id}
              className={`row-savings-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                draggingId === account.id ? 'opacity-40' : ''
              } ${
                overedId === account.id && draggingId !== account.id
                  ? 'ring-2 ring-blue-500/50 ring-inset'
                  : ''
              } ${!isActive ? 'opacity-50' : ''} ${dimmed ? 'opacity-25' : ''}`}
              {...getItemProps(account.id)}
            >
              {/* Subrow 1: drag · toggle · name */}
              <div className="flex items-center gap-2 sm:contents">
                <div
                  className="text-gray-600 hover:text-gray-400 transition-colors flex items-center justify-center select-none flex-shrink-0"
                  {...dragHandleProps(account.id)}
                >
                  <DragHandle />
                </div>
                <button
                  onClick={() => toggleAccount(account.id)}
                  title={isActive ? 'Exclude from total' : 'Include in total'}
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
                  value={account.name}
                  onChange={e => updateAccount(account.id, 'name', e.target.value)}
                  className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Chase Checking"
                />
              </div>
              {/* Subrow 2: amount · assignee · trash */}
              <div className="flex items-center gap-2 sm:contents">
                <div className="flex-1 sm:flex-none flex items-center bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 focus-within:border-blue-500">
                  <span className="text-gray-500 text-sm mr-1">$</span>
                  <CurrencyInput
                    value={account.amount}
                    onChange={val => updateAccount(account.id, 'amount', val)}
                    className="bg-transparent text-white text-sm w-full outline-none"
                    min="0"
                  />
                </div>
                <AssigneeSelect
                  people={people}
                  value={account.assignedTo ?? null}
                  onChange={val => updateAccount(account.id, 'assignedTo', val)}
                />
                <CommentButton itemId={`account_${account.id}`} label={account.name || 'Account'} />
                <button
                  onClick={() => deleteAccount(account.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center"
                  title="Remove account"
                >
                  <TrashIcon />
                </button>
              </div>
              {/* Description / notes */}
              <div className="sm:col-span-7">
                <input
                  type="text"
                  value={account.description || ''}
                  onChange={e => updateAccount(account.id, 'description', e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600/50 rounded-lg px-3 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-blue-500 placeholder-gray-600"
                  placeholder="Add a note..."
                />
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={addAccount}
        className="w-full py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-blue-500 hover:text-blue-400 text-sm transition-colors"
      >
        + Add Account
      </button>

      <div className="bg-gray-700/40 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">Total Cash Available</span>
        <span className="text-white text-2xl font-bold sensitive">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
