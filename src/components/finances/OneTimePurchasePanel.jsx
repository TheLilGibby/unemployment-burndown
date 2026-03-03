import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import TransactionLinkButton from '../linking/TransactionLinkButton'
import CurrencyInput from './CurrencyInput'

const MEDIUM_OPTIONS = [
  'Venmo',
  'Zelle',
  'Cash',
  'Debit Card',
  'Credit Card',
  'PayPal',
  'Bank Transfer',
  'Check',
  'Other',
]

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

export default function OneTimePurchasePanel({ purchases, onChange, people = [], filterPersonId = null, allTransactions = [], transactionLinks = {}, onOpenTransactionLookup }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(purchases, onChange)

  function updatePurchase(id, field, val) {
    onChange(purchases.map(p => p.id === id ? { ...p, [field]: val } : p))
  }

  function deletePurchase(id) {
    onChange(purchases.filter(p => p.id !== id))
  }

  function addPurchase() {
    onChange([
      ...purchases,
      { id: Date.now(), description: 'New Purchase', date: new Date().toISOString().slice(0, 10), amount: 0, medium: 'Venmo', assignedTo: null },
    ])
  }

  const total = purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const showLinkCol = allTransactions.length > 0 || Object.keys(transactionLinks).some(k => k.startsWith('otp_'))

  return (
    <div className="space-y-3">
      {purchases.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">
          No one-time purchases yet. Track individual purchases like appliances, electronics, or other one-time buys.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: showLinkCol ? '20px 1fr 110px 120px 110px 32px 32px 32px 32px' : '20px 1fr 110px 120px 110px 32px 32px 32px' }}
          >
            <span></span>
            <span>Description</span>
            <span>Date</span>
            <span>Medium</span>
            <span>Amount</span>
            <span></span>
            <span></span>
            {showLinkCol && <span></span>}
            <span></span>
          </div>

          {/* Purchase rows */}
          <div className="space-y-2">
            {purchases.map(purchase => {
              const dimmed = filterPersonId && !matchesPersonFilter(purchase.assignedTo, filterPersonId)
              const overviewKey = `otp_${purchase.id}`
              return (
              <div
                key={purchase.id}
                className={`row-onetimepurch-sm flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                  draggingId === purchase.id ? 'opacity-40' : ''
                } ${
                  overedId === purchase.id && draggingId !== purchase.id
                    ? 'ring-2 ring-red-500/50 ring-inset'
                    : ''
                } ${dimmed ? 'opacity-25' : ''}`}
                {...getItemProps(purchase.id)}
              >
                {/* Subrow 1: drag + description */}
                <div className="flex items-center gap-2 sm:contents">
                  <div
                    className="text-gray-600 hover:text-gray-400 transition-colors flex items-center justify-center select-none flex-shrink-0"
                    {...dragHandleProps(purchase.id)}
                  >
                    <DragHandle />
                  </div>
                  <input
                    type="text"
                    value={purchase.description}
                    onChange={e => updatePurchase(purchase.id, 'description', e.target.value)}
                    className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Description"
                  />
                </div>
                {/* Subrow 2: date + medium + amount + assignee + comment + link + trash */}
                <div className="flex items-center gap-2 sm:contents">
                  <input
                    type="date"
                    value={purchase.date}
                    onChange={e => updatePurchase(purchase.id, 'date', e.target.value)}
                    className="min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={purchase.medium || 'Other'}
                    onChange={e => updatePurchase(purchase.id, 'medium', e.target.value)}
                    className="min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {MEDIUM_OPTIONS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="flex-1 sm:flex-none flex items-center bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 focus-within:border-blue-500">
                    <span className="text-gray-500 text-sm mr-1">$</span>
                    <CurrencyInput
                      value={purchase.amount}
                      onChange={val => updatePurchase(purchase.id, 'amount', val)}
                      className="bg-transparent text-white text-sm w-full outline-none"
                      min="0"
                    />
                  </div>
                  <AssigneeSelect
                    people={people}
                    value={purchase.assignedTo ?? null}
                    onChange={val => updatePurchase(purchase.id, 'assignedTo', val)}
                  />
                  <CommentButton itemId={overviewKey} label={purchase.description || 'One-Time Purchase'} />
                  {showLinkCol && (
                    <TransactionLinkButton
                      overviewKey={overviewKey}
                      overviewItem={purchase}
                      linkedTransactions={transactionLinks[overviewKey] || []}
                      allTransactions={allTransactions}
                      onOpenLookup={onOpenTransactionLookup}
                    />
                  )}
                  <button
                    onClick={() => deletePurchase(purchase.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors flex items-center justify-center"
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
        onClick={addPurchase}
        className="w-full py-2 rounded-lg border border-dashed border-gray-600 text-gray-500 hover:border-red-500 hover:text-red-400 text-sm transition-colors"
      >
        + Add One-Time Purchase
      </button>

      {purchases.length > 0 && (
        <div className="bg-gray-700/40 rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total purchases: </span>
            <span className="text-red-300 font-semibold">{formatCurrency(total)}</span>
          </div>
          <div>
            <span className="text-gray-500">Count: </span>
            <span className="text-white font-semibold">{purchases.length} purchase{purchases.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Medium breakdown */}
          {(() => {
            const byMedium = {}
            for (const p of purchases) {
              const m = p.medium || 'Other'
              byMedium[m] = (byMedium[m] || 0) + (Number(p.amount) || 0)
            }
            const entries = Object.entries(byMedium).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
            if (entries.length <= 1) return null
            return entries.map(([medium, amt]) => (
              <div key={medium}>
                <span className="text-gray-500">{medium}: </span>
                <span className="text-red-300/80 font-medium">{formatCurrency(amt)}</span>
              </div>
            ))
          })()}
        </div>
      )}

      <p className="text-xs text-gray-600">
        One-time purchases are deducted on their specific date. Drag <span className="text-gray-500">&zwj;&#10303;</span> to reorder.
      </p>
    </div>
  )
}
