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

export default function MonthlyIncomePanel({ items, onChange, people = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(items, onChange)

  function updateItem(id, field, val) {
    onChange(items.map(item => item.id === id ? { ...item, [field]: val } : item))
  }

  function deleteItem(id) {
    onChange(items.filter(item => item.id !== id))
  }

  function addItem() {
    onChange([
      ...items,
      { id: Date.now(), description: 'Part-Time Job', monthlyAmount: 0, startDate: '', endDate: '', assignedTo: null },
    ])
  }

  const total = items.reduce((sum, item) => sum + (Number(item.monthlyAmount) || 0), 0)

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
          No recurring income yet. Add part-time work, rental income, freelance retainers, or any regular income source.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: '20px 1fr 110px 120px 120px 32px 32px 32px', color: 'var(--text-muted)' }}
          >
            <span></span>
            <span>Source</span>
            <span>Monthly</span>
            <span>Start Date</span>
            <span>End Date</span>
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="space-y-2">
            {items.map(item => {
              const dimmed = filterPersonId && !matchesPersonFilter(item.assignedTo, filterPersonId)
              return (
              <div
                key={item.id}
                className={`flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                  draggingId === item.id ? 'opacity-40' : ''
                } ${
                  overedId === item.id && draggingId !== item.id
                    ? 'ring-2 ring-emerald-500/50 ring-inset'
                    : ''
                } ${dimmed ? 'opacity-25' : ''}`}
                style={{ gridTemplateColumns: '20px 1fr 110px 120px 120px 32px 32px 32px' }}
                {...getItemProps(item.id)}
              >
                {/* Row 1 (mobile): drag + description */}
                <div className="flex items-center gap-2 sm:contents">
                  <div
                    className="flex items-center justify-center select-none flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    {...dragHandleProps(item.id)}
                  >
                    <DragHandle />
                  </div>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                    className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="Income source"
                  />
                </div>

                {/* Row 2 (mobile): amount · start · end · assignee · trash */}
                <div className="flex items-center gap-2 sm:contents">
                  <div
                    className="flex-1 sm:flex-none flex items-center rounded-lg px-2 py-2 focus-within:ring-1 focus-within:ring-emerald-500"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
                  >
                    <span className="text-sm mr-1" style={{ color: 'var(--accent-emerald)' }}>+$</span>
                    <CurrencyInput
                      value={item.monthlyAmount}
                      onChange={val => updateItem(item.id, 'monthlyAmount', val)}
                      className="bg-transparent text-sm w-full outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      min="0"
                    />
                  </div>
                  <input
                    type="date"
                    value={item.startDate}
                    onChange={e => updateItem(item.id, 'startDate', e.target.value)}
                    className="flex-shrink-0 rounded-lg px-2 py-2 text-sm focus:outline-none w-full sm:w-auto"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                    }}
                    title="Start date (leave blank = starts immediately)"
                  />
                  <input
                    type="date"
                    value={item.endDate}
                    onChange={e => updateItem(item.id, 'endDate', e.target.value)}
                    className="flex-shrink-0 rounded-lg px-2 py-2 text-sm focus:outline-none w-full sm:w-auto"
                    style={{
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                    }}
                    title="End date (leave blank = indefinite)"
                  />
                  <AssigneeSelect
                    people={people}
                    value={item.assignedTo ?? null}
                    onChange={val => updateItem(item.id, 'assignedTo', val)}
                  />
                  <CommentButton itemId={`inc_${item.id}`} label={item.description || 'Monthly Income'} />
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="flex items-center justify-center transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
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
        onClick={addItem}
        className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent-emerald)'
          e.currentTarget.style.color = 'var(--accent-emerald)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        + Add Monthly Income
      </button>

      {items.length > 0 && (
        <div className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm" style={{ background: 'color-mix(in srgb, var(--accent-emerald) 10%, transparent)' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Total monthly: </span>
            <span className="font-semibold sensitive" style={{ color: 'var(--accent-emerald)' }}>+{formatCurrency(total)}/mo</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Sources: </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Reduces monthly burn each month it's active. Leave start/end dates blank for income covering the entire runway. Drag <span style={{ color: 'var(--text-muted)' }}>⠿</span> to reorder.
      </p>
    </div>
  )
}
