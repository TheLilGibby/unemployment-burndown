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

export default function HomeImprovementPanel({ improvements, onChange, properties = [], people = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(improvements, onChange)

  function updateItem(id, field, val) {
    onChange(improvements.map(i => i.id === id ? { ...i, [field]: val } : i))
  }

  function deleteItem(id) {
    onChange(improvements.filter(i => i.id !== id))
  }

  function addItem() {
    onChange([
      ...improvements,
      {
        id: Date.now(),
        description: 'New Improvement',
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        propertyId: properties.length > 0 ? properties[0].id : null,
        assignedTo: null,
      },
    ])
  }

  const total = improvements.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

  return (
    <div className="space-y-3">
      {improvements.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No home improvements yet. Track renovation projects, repairs, and upgrades against your properties.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: '20px 1fr 130px 150px 110px 32px 32px 32px', color: 'var(--text-secondary)' }}
          >
            <span></span>
            <span>Description</span>
            <span>Date</span>
            <span>Property</span>
            <span>Amount</span>
            <span></span>
            <span></span>
            <span></span>
          </div>

          {/* Improvement rows */}
          <div className="space-y-2">
            {improvements.map(item => {
              const dimmed = filterPersonId && !matchesPersonFilter(item.assignedTo, filterPersonId)
              const overviewKey = `hi_${item.id}`
              return (
                <div
                  key={item.id}
                  className={`row-homeimprove-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                    draggingId === item.id ? 'opacity-40' : ''
                  } ${
                    overedId === item.id && draggingId !== item.id
                      ? 'ring-2 ring-amber-500/50 ring-inset'
                      : ''
                  } ${dimmed ? 'opacity-25' : ''}`}
                  {...getItemProps(item.id)}
                >
                  {/* Subrow 1: drag + description */}
                  <div className="flex items-center gap-2 sm:contents">
                    <div
                      className="transition-colors flex items-center justify-center select-none flex-shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      {...dragHandleProps(item.id)}
                    >
                      <DragHandle />
                    </div>
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                      className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                      style={{
                        background: 'var(--bg-page)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="Description"
                    />
                  </div>
                  {/* Subrow 2: date + property + amount + assignee + comment + trash */}
                  <div className="flex items-center gap-2 sm:contents">
                    <input
                      type="date"
                      value={item.date}
                      onChange={e => updateItem(item.id, 'date', e.target.value)}
                      className="min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                      style={{
                        background: 'var(--bg-page)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <select
                      value={item.propertyId ?? ''}
                      onChange={e => updateItem(item.id, 'propertyId', e.target.value ? Number(e.target.value) : null)}
                      className="min-w-0 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                      style={{
                        background: 'var(--bg-page)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="">No property</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.address || `Property #${p.id}`}
                        </option>
                      ))}
                    </select>
                    <div
                      className="flex-1 sm:flex-none flex items-center rounded-lg px-2 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                      style={{
                        background: 'var(--bg-page)',
                        border: '1px solid var(--border-input)',
                      }}
                    >
                      <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={item.amount}
                        onChange={val => updateItem(item.id, 'amount', val)}
                        className="bg-transparent text-sm w-full outline-none"
                        style={{ color: 'var(--text-primary)' }}
                        min="0"
                      />
                    </div>
                    <AssigneeSelect
                      people={people}
                      value={item.assignedTo ?? null}
                      onChange={val => updateItem(item.id, 'assignedTo', val)}
                    />
                    <CommentButton itemId={overviewKey} label={item.description || 'Home Improvement'} />
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="transition-colors flex items-center justify-center"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <button
        onClick={addItem}
        className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#f59e0b'
          e.currentTarget.style.color = '#fbbf24'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        + Add Home Improvement
      </button>

      {improvements.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Total improvements: </span>
            <span className="text-amber-300 font-semibold sensitive">{formatCurrency(total)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Count: </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{improvements.length} improvement{improvements.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Per-property breakdown */}
          {(() => {
            const byProp = {}
            for (const i of improvements) {
              const prop = properties.find(p => p.id === i.propertyId)
              const label = prop ? (prop.address || `Property #${prop.id}`) : 'Unassigned'
              byProp[label] = (byProp[label] || 0) + (Number(i.amount) || 0)
            }
            const entries = Object.entries(byProp).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
            if (entries.length <= 1) return null
            return entries.map(([label, amt]) => (
              <div key={label}>
                <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
                <span className="text-amber-300/80 font-medium sensitive">{formatCurrency(amt)}</span>
              </div>
            ))
          })()}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Home improvements are deducted on their specific date. Drag <span style={{ color: 'var(--text-muted)' }}>&#x2800;&#x283F;</span> to reorder.
      </p>
    </div>
  )
}
