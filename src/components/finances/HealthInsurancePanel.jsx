import dayjs from 'dayjs'
import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import CurrencyInput from './CurrencyInput'

const PLAN_TYPES = [
  { value: 'cobra', label: 'COBRA' },
  { value: 'aca', label: 'ACA / Marketplace' },
  { value: 'spouse', label: "Spouse's Plan" },
  { value: 'other', label: 'Other' },
]

const DEFAULT_DESCRIPTIONS = {
  cobra: 'COBRA Continuation',
  aca: 'ACA Marketplace Plan',
  spouse: "Spouse's Employer Plan",
  other: 'Health Insurance',
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function HealthInsurancePanel({ items, onChange, people = [], expenses = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(items, onChange)

  function updateItem(id, field, val) {
    onChange(items.map(item => item.id === id ? { ...item, [field]: val } : item))
  }

  function deleteItem(id) {
    onChange(items.filter(item => item.id !== id))
  }

  function handleTypeChange(id, newType) {
    const item = items.find(i => i.id === id)
    const updates = { type: newType }
    // Auto-fill description if it matches a default or is empty
    if (!item.description || Object.values(DEFAULT_DESCRIPTIONS).includes(item.description)) {
      updates.description = DEFAULT_DESCRIPTIONS[newType] || ''
    }
    // For COBRA, auto-suggest 18-month end date from start
    if (newType === 'cobra' && item.startDate && !item.endDate) {
      updates.endDate = dayjs(item.startDate).add(18, 'month').format('YYYY-MM-DD')
    }
    onChange(items.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  function handleStartDateChange(id, newStart) {
    const item = items.find(i => i.id === id)
    const updates = { startDate: newStart }
    // Auto-suggest COBRA 18-month end date
    if (item.type === 'cobra' && newStart && !item.endDate) {
      updates.endDate = dayjs(newStart).add(18, 'month').format('YYYY-MM-DD')
    }
    onChange(items.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  function addItem() {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        type: 'cobra',
        description: DEFAULT_DESCRIPTIONS.cobra,
        monthlyPremium: 0,
        startDate: '',
        endDate: '',
        assignedTo: null,
      },
    ])
  }

  const today = dayjs()
  const activeItems = items.filter(item => {
    if (!item.monthlyPremium) return false
    if (item.startDate && dayjs(item.startDate).isAfter(today)) return false
    if (item.endDate && dayjs(item.endDate).isBefore(today)) return false
    return true
  })
  const totalActivePremium = activeItems.reduce((sum, item) => sum + (Number(item.monthlyPremium) || 0), 0)

  const hasHealthExpense = expenses.some(e =>
    e.category && /health|insurance/i.test(e.category) && (Number(e.monthlyAmount) || 0) > 0
  )

  return (
    <div className="space-y-3">
      {/* Double-counting warning */}
      {hasHealthExpense && items.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
          style={{ background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)', color: 'var(--accent-amber)' }}
        >
          <span className="flex-shrink-0 mt-0.5">&#9888;</span>
          <span>
            You have a <strong>"Health / Insurance"</strong> item in Monthly Expenses.
            Consider removing or zeroing it to avoid double-counting with these coverage phases.
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
          No health insurance phases yet. Model COBRA, ACA marketplace, or spouse plan costs over time.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: '20px 100px 1fr 110px 120px 120px 32px 32px 32px', color: 'var(--text-muted)' }}
          >
            <span></span>
            <span>Type</span>
            <span>Description</span>
            <span>Premium</span>
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
                  style={{ gridTemplateColumns: '20px 100px 1fr 110px 120px 120px 32px 32px 32px' }}
                  {...getItemProps(item.id)}
                >
                  {/* Row 1 (mobile): drag + type + description */}
                  <div className="flex items-center gap-2 sm:contents">
                    <div
                      className="flex items-center justify-center select-none flex-shrink-0 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      {...dragHandleProps(item.id)}
                    >
                      <DragHandle />
                    </div>
                    <select
                      value={item.type || 'other'}
                      onChange={e => handleTypeChange(item.id, e.target.value)}
                      className="rounded-lg px-2 py-2 text-sm focus:outline-none"
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {PLAN_TYPES.map(pt => (
                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                      ))}
                    </select>
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
                      placeholder="Coverage description"
                    />
                  </div>

                  {/* Row 2 (mobile): premium · start · end · assignee · trash */}
                  <div className="flex items-center gap-2 sm:contents">
                    <div
                      className="flex-1 sm:flex-none flex items-center rounded-lg px-2 py-2 focus-within:ring-1 focus-within:ring-red-400"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
                    >
                      <span className="text-sm mr-1" style={{ color: 'var(--accent-red, #f87171)' }}>$</span>
                      <CurrencyInput
                        value={item.monthlyPremium}
                        onChange={val => updateItem(item.id, 'monthlyPremium', val)}
                        className="bg-transparent text-sm w-full outline-none"
                        style={{ color: 'var(--text-primary)' }}
                        min="0"
                      />
                    </div>
                    <input
                      type="date"
                      value={item.startDate}
                      onChange={e => handleStartDateChange(item.id, e.target.value)}
                      className="flex-shrink-0 rounded-lg px-2 py-2 text-sm focus:outline-none w-full sm:w-auto"
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                      title="Coverage start date"
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
                      title={item.type === 'cobra' ? 'End date (COBRA max 18 months)' : 'Coverage end date'}
                    />
                    <AssigneeSelect
                      people={people}
                      value={item.assignedTo ?? null}
                      onChange={val => updateItem(item.id, 'assignedTo', val)}
                    />
                    <CommentButton itemId={`hi_${item.id}`} label={item.description || 'Health Insurance'} />
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

                  {/* COBRA 18-month hint */}
                  {item.type === 'cobra' && item.startDate && item.endDate && (
                    <div className="col-span-full text-xs pl-7" style={{ color: 'var(--text-faint)' }}>
                      {dayjs(item.endDate).diff(dayjs(item.startDate), 'month')} month coverage
                      {dayjs(item.endDate).diff(dayjs(item.startDate), 'month') > 18 && (
                        <span style={{ color: 'var(--accent-amber)' }}> — COBRA max is typically 18 months</span>
                      )}
                    </div>
                  )}
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
          e.currentTarget.style.borderColor = 'var(--accent-blue)'
          e.currentTarget.style.color = 'var(--accent-blue)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        + Add Coverage Phase
      </button>

      {/* Reference card: average COBRA costs */}
      <div
        className="rounded-lg px-4 py-3 text-xs space-y-1"
        style={{ background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)', color: 'var(--text-muted)' }}
      >
        <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Average COBRA Premiums (2024 KFF Survey)</p>
        <div className="flex gap-6">
          <span>Individual: <strong style={{ color: 'var(--text-primary)' }}>~$656/mo</strong></span>
          <span>Family: <strong style={{ color: 'var(--text-primary)' }}>~$1,867/mo</strong></span>
        </div>
        <p>COBRA covers up to 18 months (36 for qualifying events). ACA open enrollment or special enrollment after job loss.</p>
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <div className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm" style={{ background: 'color-mix(in srgb, var(--accent-red, #f87171) 10%, transparent)' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Active monthly premium: </span>
            <span className="font-semibold sensitive" style={{ color: 'var(--accent-red, #f87171)' }}>{formatCurrency(totalActivePremium)}/mo</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Phases: </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{items.length} plan{items.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Model health insurance costs as time-bounded phases. Premiums are added to your monthly burn during each phase's date range. Drag <span style={{ color: 'var(--text-muted)' }}>&#10782;</span> to reorder.
      </p>
    </div>
  )
}
