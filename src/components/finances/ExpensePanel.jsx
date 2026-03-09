import { useState } from 'react'
import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import CurrencyInput from './CurrencyInput'
import ConfirmDeleteModal from '../common/ConfirmDeleteModal'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function ExpensePanel({ expenses, onChange, people = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(expenses, onChange)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  function toggleSelected(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === expenses.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(expenses.map(e => e.id)))
    }
  }

  function applyBulkCategory() {
    if (!bulkCategory.trim() || selectedIds.size === 0) return
    onChange(expenses.map(e => selectedIds.has(e.id) ? { ...e, category: bulkCategory.trim() } : e))
    setSelectedIds(new Set())
    setBulkCategory('')
  }

  function updateExpense(id, field, val) {
    onChange(expenses.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  function deleteExpense(id) {
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    onChange(expenses.filter(e => e.id !== id))
  }

  function addExpense() {
    onChange([...expenses, { id: Date.now(), category: 'New Expense', monthlyAmount: 0, essential: false, assignedTo: null, description: '' }])
  }

  const totalMonthly = expenses.reduce((sum, e) => sum + (Number(e.monthlyAmount) || 0), 0)
  const essentialTotal = expenses.filter(e => e.essential).reduce((sum, e) => sum + (Number(e.monthlyAmount) || 0), 0)

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-600/40 rounded-lg px-3 py-2">
          <span className="text-xs text-blue-300 font-medium whitespace-nowrap">
            {selectedIds.size} selected
          </span>
          <input
            type="text"
            value={bulkCategory}
            onChange={e => setBulkCategory(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyBulkCategory()}
            placeholder="New category name..."
            className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/60"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={applyBulkCategory}
            disabled={!bulkCategory.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Update Category
          </button>
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkCategory('') }}
            className="text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Column headers — desktop only */}
      <div
        className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
        style={{ gridTemplateColumns: '24px 20px 1fr 110px 80px 32px 32px 32px', color: 'var(--text-secondary)' }}
      >
        <span className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={expenses.length > 0 && selectedIds.size === expenses.length}
            onChange={toggleSelectAll}
            className="accent-blue-500 cursor-pointer"
            title="Select all"
          />
        </span>
        <span></span>
        <span>Category</span>
        <span>Monthly</span>
        <span className="text-center">Essential</span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      {/* Expense rows */}
      <div className="space-y-2">
        {expenses.map(expense => {
          const dimmed = filterPersonId && !matchesPersonFilter(expense.assignedTo, filterPersonId)
          return (
          <div
            key={expense.id}
            className={`row-expense-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
              draggingId === expense.id ? 'opacity-40' : ''
            } ${
              overedId === expense.id && draggingId !== expense.id
                ? 'ring-2 ring-blue-500/50 ring-inset'
                : ''
            } ${dimmed ? 'opacity-25' : ''}`}
            {...getItemProps(expense.id)}
          >
            {/* Subrow 1: checkbox · drag · category name */}
            <div className="flex items-center gap-2 sm:contents">
              <div className="flex items-center justify-center flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(expense.id)}
                  onChange={() => toggleSelected(expense.id)}
                  className="accent-blue-500 cursor-pointer"
                />
              </div>
              <div
                className="transition-colors flex items-center justify-center select-none flex-shrink-0"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                {...dragHandleProps(expense.id)}
              >
                <DragHandle />
              </div>
              <input
                type="text"
                value={expense.category}
                onChange={e => updateExpense(expense.id, 'category', e.target.value)}
                className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                style={{
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border-input)',
                  color: 'var(--text-primary)',
                }}
                placeholder="Category name"
              />
            </div>
            {/* Subrow 2: amount · essential · assignee · trash */}
            <div className="flex items-center gap-2 sm:contents">
              <div
                className="flex-1 sm:flex-none flex items-center rounded-lg px-2 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                style={{
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border-input)',
                }}
              >
                <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                <CurrencyInput
                  value={expense.monthlyAmount}
                  onChange={val => updateExpense(expense.id, 'monthlyAmount', val)}
                  className="bg-transparent text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  min="0"
                />
              </div>
              <div className="flex justify-center flex-shrink-0">
                <button
                  onClick={() => updateExpense(expense.id, 'essential', !expense.essential)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    expense.essential
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-600/50'
                      : ''
                  }`}
                  style={!expense.essential ? {
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-input)',
                    color: 'var(--text-muted)',
                  } : {}}
                >
                  {expense.essential ? 'Yes' : 'No'}
                </button>
              </div>
              <AssigneeSelect
                people={people}
                value={expense.assignedTo ?? null}
                onChange={val => updateExpense(expense.id, 'assignedTo', val)}
              />
              <CommentButton itemId={`expense_${expense.id}`} label={expense.category || 'Expense'} />
              <button
                onClick={() => setPendingDeleteId(expense.id)}
                className="transition-colors flex items-center justify-center"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <TrashIcon />
              </button>
            </div>
            {/* Subrow 3: description / notes */}
            <div className="sm:col-span-8">
              <input
                type="text"
                value={expense.description || ''}
                onChange={e => updateExpense(expense.id, 'description', e.target.value)}
                className="w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/60"
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

      {/* Add row */}
      <button
        onClick={addExpense}
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
        + Add Expense
      </button>

      {/* Totals */}
      <div
        className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Total monthly: </span>
          <span className="font-semibold sensitive" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalMonthly)}/mo</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Essential: </span>
          <span className="text-blue-300 font-semibold sensitive">{formatCurrency(essentialTotal)}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Discretionary: </span>
          <span className="font-semibold sensitive" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(totalMonthly - essentialTotal)}</span>
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        "Essential" expenses are protected from the What-If expense reduction slider. Drag <span style={{ color: 'var(--text-muted)' }}>⠿</span> to reorder.
      </p>

      {pendingDeleteId != null && (
        <ConfirmDeleteModal
          itemName={expenses.find(e => e.id === pendingDeleteId)?.category || 'this expense'}
          onConfirm={() => { deleteExpense(pendingDeleteId); setPendingDeleteId(null) }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  )
}
