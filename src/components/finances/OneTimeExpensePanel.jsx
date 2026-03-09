import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import TransactionLinkButton from '../linking/TransactionLinkButton'
import CurrencyInput from './CurrencyInput'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function OneTimeExpensePanel({ expenses, onChange, people = [], filterPersonId = null, allTransactions = [], transactionLinks = {}, onOpenTransactionLookup }) {
  // Note: one-time expenses support manual drag reorder (overrides date sort for display)
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(expenses, onChange)

  function updateExpense(id, field, val) {
    onChange(expenses.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  function deleteExpense(id) {
    onChange(expenses.filter(e => e.id !== id))
  }

  function addExpense() {
    onChange([
      ...expenses,
      { id: Date.now(), description: 'New Expense', date: '2026-03-01', amount: 0, assignedTo: null },
    ])
  }

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const showLinkCol = allTransactions.length > 0 || Object.keys(transactionLinks).some(k => k.startsWith('ote_'))

  return (
    <div className="space-y-3">
      {expenses.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-faint)' }}>
          No one-time expenses yet. Add things like car repairs, medical bills, or annual subscriptions.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
            style={{
              gridTemplateColumns: showLinkCol ? '20px 1fr 130px 110px 32px 32px 32px 32px' : '20px 1fr 130px 110px 32px 32px 32px',
              color: 'var(--text-secondary)',
            }}
          >
            <span></span>
            <span>Description</span>
            <span>Date</span>
            <span>Amount</span>
            <span></span>
            <span></span>
            {showLinkCol && <span></span>}
            <span></span>
          </div>

          {/* Expense rows */}
          <div className="space-y-2">
            {expenses.map(expense => {
              const dimmed = filterPersonId && !matchesPersonFilter(expense.assignedTo, filterPersonId)
              const overviewKey = `ote_${expense.id}`
              return (
              <div
                key={expense.id}
                className={`row-onetimeexp-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                  draggingId === expense.id ? 'opacity-40' : ''
                } ${
                  overedId === expense.id && draggingId !== expense.id
                    ? 'ring-2 ring-orange-500/50 ring-inset'
                    : ''
                } ${dimmed ? 'opacity-25' : ''}`}
                {...getItemProps(expense.id)}
              >
                {/* Subrow 1: drag · description */}
                <div className="flex items-center gap-2 sm:contents">
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
                    value={expense.description}
                    onChange={e => updateExpense(expense.id, 'description', e.target.value)}
                    className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                    style={{
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="Description"
                  />
                </div>
                {/* Subrow 2: date · amount · assignee · comment · link · trash */}
                <div className="flex items-center gap-2 sm:contents">
                  <input
                    type="date"
                    value={expense.date}
                    onChange={e => updateExpense(expense.id, 'date', e.target.value)}
                    className="min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                    style={{
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <div
                    className="flex-1 sm:flex-none flex items-center rounded-lg px-2 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                    style={{
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border-input)',
                    }}
                  >
                    <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                    <CurrencyInput
                      value={expense.amount}
                      onChange={val => updateExpense(expense.id, 'amount', val)}
                      className="bg-transparent text-sm w-full outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      min="0"
                    />
                  </div>
                  <AssigneeSelect
                    people={people}
                    value={expense.assignedTo ?? null}
                    onChange={val => updateExpense(expense.id, 'assignedTo', val)}
                  />
                  <CommentButton itemId={overviewKey} label={expense.description || 'One-Time Expense'} />
                  {showLinkCol && (
                    <TransactionLinkButton
                      overviewKey={overviewKey}
                      overviewItem={expense}
                      linkedTransactions={transactionLinks[overviewKey] || []}
                      allTransactions={allTransactions}
                      onOpenLookup={onOpenTransactionLookup}
                    />
                  )}
                  <button
                    onClick={() => deleteExpense(expense.id)}
                    className="transition-colors flex items-center justify-center"
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
        onClick={addExpense}
        className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#f97316'
          e.currentTarget.style.color = '#fb923c'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        + Add One-Time Expense
      </button>

      {expenses.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Total one-time: </span>
            <span className="text-orange-300 font-semibold sensitive">{formatCurrency(total)}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Count: </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        One-time expenses are deducted on their specific date. Drag <span style={{ color: 'var(--text-muted)' }}>&#x2800;&#x283F;</span> to reorder.
      </p>
    </div>
  )
}
