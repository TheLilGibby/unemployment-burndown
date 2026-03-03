import { Link } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatters'
import { matchesPersonFilter } from '../../utils/personFilter'
import { getEffectivePayment } from '../../utils/ccPayment'
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

/** Small labeled input used in the details row */
function DetailField({ label, prefix, suffix, value, onChange, min, max, step, placeholder, type = 'number', maxLength }) {
  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div
        className="flex items-center rounded-md px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-blue-500/60"
        style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)' }}
      >
        {prefix && <span className="mr-1 text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{prefix}</span>}
        {prefix === '$' && type === 'number' ? (
          <CurrencyInput
            value={value ?? 0}
            onChange={onChange}
            className="bg-transparent outline-none w-full"
            style={{ color: 'var(--text-primary)', minWidth: 0 }}
            min={min}
            placeholder={placeholder ?? '0'}
          />
        ) : (
          <input
            type={type}
            value={value ?? ''}
            onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
            className="bg-transparent outline-none w-full"
            style={{ color: 'var(--text-primary)', minWidth: 0 }}
            min={min}
            max={max}
            step={step}
            maxLength={maxLength}
            placeholder={placeholder ?? '—'}
          />
        )}
        {suffix && <span className="ml-1 text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
      </div>
    </label>
  )
}

/** Utilization badge — colour shifts red as utilization climbs */
function UtilBadge({ balance, limit }) {
  if (!limit || limit <= 0) return null
  const pct = Math.min(100, Math.round((balance / limit) * 100))
  const color =
    pct >= 90 ? '#f87171' :   // red-400
    pct >= 60 ? '#fb923c' :   // orange-400
    pct >= 30 ? '#facc15' :   // yellow-400
                '#34d399'      // emerald-400

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Utilization
      </span>
      <div className="flex items-center gap-2 py-1.5">
        {/* bar */}
        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>{pct}%</span>
      </div>
    </div>
  )
}

export default function CreditCardsPanel({ cards, onChange, people = [], filterPersonId = null }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(cards, onChange)

  function updateCard(id, field, val) {
    onChange(cards.map(c => c.id === id ? { ...c, [field]: val } : c))
  }

  function deleteCard(id) {
    onChange(cards.filter(c => c.id !== id))
  }

  function addCard() {
    onChange([...cards, {
      id: Date.now(),
      name: 'New Card',
      balance: 0,
      minimumPayment: 0,
      creditLimit: 0,
      apr: 0,
      statementCloseDay: '',
      last4: '',
      assignedTo: null,
      paymentStrategy: 'minimum',
      paymentAmount: 0,
    }])
  }

  const totalBalance    = cards.reduce((sum, c) => sum + (Number(c.balance) || 0), 0)
  const totalMinimum    = cards.reduce((sum, c) => sum + (Number(c.minimumPayment) || 0), 0)
  const totalEffective  = cards.reduce((sum, c) => sum + getEffectivePayment(c), 0)
  const totalLimit      = cards.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0)
  const overallUtil  = totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 100) : null

  // Weighted-average APR by outstanding balance
  const avgApr = (() => {
    const withBal = cards.filter(c => Number(c.balance) > 0 && Number(c.apr) > 0)
    if (!withBal.length) return null
    const totalBal = withBal.reduce((s, c) => s + Number(c.balance), 0)
    if (!totalBal) return null
    return (withBal.reduce((s, c) => s + Number(c.apr) * Number(c.balance), 0) / totalBal).toFixed(1)
  })()

  return (
    <div className="space-y-3">
      {cards.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
          No cards yet. Add credit cards or any outstanding debt to track balances and minimum payments.
        </p>
      ) : (
        <div className="space-y-3">
          {cards.map(card => {
            const dimmed = filterPersonId && !matchesPersonFilter(card.assignedTo, filterPersonId)
            return (
            <div
              key={card.id}
              className={`rounded-xl border transition-all ${
                draggingId === card.id ? 'opacity-40' : ''
              } ${
                overedId === card.id && draggingId !== card.id
                  ? 'ring-2 ring-blue-500/50'
                  : ''
              } ${dimmed ? 'opacity-25' : ''}`}
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)' }}
              {...getItemProps(card.id)}
            >
              {/* ── Primary row ── */}
              <div className="flex flex-col gap-2 p-3 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2">
                {/* Mobile subrow 1 / Desktop inline: drag + name */}
                <div className="flex items-center gap-2 sm:contents">
                  {/* Drag handle */}
                  <div
                    className="flex items-center justify-center select-none flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    {...dragHandleProps(card.id)}
                  >
                    <DragHandle />
                  </div>

                  {/* Card name */}
                  <input
                    type="text"
                    value={card.name}
                    onChange={e => updateCard(card.id, 'name', e.target.value)}
                    className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border-input)',
                      color: 'var(--text-primary)',
                    }}
                    placeholder="Card name"
                  />
                </div>

                {/* Mobile subrow 2 / Desktop inline: balance + min pmt + assignee + trash */}
                <div className="flex items-center gap-2 sm:contents">
                  {/* Balance owed */}
                  <div
                    className="flex-1 sm:flex-none sm:w-[120px] flex items-center rounded-lg px-2 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                    style={{
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border-input)',
                      minWidth: '80px',
                    }}
                  >
                    <span className="text-sm mr-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>$</span>
                    <CurrencyInput
                      value={card.balance}
                      onChange={val => updateCard(card.id, 'balance', val)}
                      className="bg-transparent text-sm w-full outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      min="0"
                      placeholder="Balance"
                    />
                  </div>

                  {/* Min payment */}
                  <div
                    className="flex-1 sm:flex-none sm:w-[120px] flex items-center rounded-lg px-2 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                    style={{
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border-input)',
                      minWidth: '80px',
                    }}
                  >
                    <span className="text-xs mr-1 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>min $</span>
                    <CurrencyInput
                      value={card.minimumPayment}
                      onChange={val => updateCard(card.id, 'minimumPayment', val)}
                      className="bg-transparent text-sm w-full outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      min="0"
                      placeholder="Min pmt"
                    />
                  </div>

                  {/* Assignee + statements + comment + delete */}
                  <AssigneeSelect
                    people={people}
                    value={card.assignedTo ?? null}
                    onChange={val => updateCard(card.id, 'assignedTo', val)}
                  />
                  <Link
                    to={`/credit-cards?card=${card.id}`}
                    className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded transition-colors"
                    style={{ color: 'var(--accent-blue)', opacity: 0.7 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                    title="View statements"
                  >
                    Stmts
                  </Link>
                  <CommentButton itemId={`card_${card.id}`} label={card.name || 'Credit Card'} />
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="flex-shrink-0 flex items-center justify-center transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>

              {/* ── Details row ── */}
              <div
                className="flex flex-wrap items-end gap-x-4 gap-y-2 px-3 pb-3 pt-2"
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <DetailField
                  label="Credit Limit"
                  prefix="$"
                  value={card.creditLimit}
                  onChange={val => updateCard(card.id, 'creditLimit', val)}
                  min={0}
                  step={100}
                  placeholder="0"
                />
                <DetailField
                  label="APR"
                  suffix="%"
                  value={card.apr}
                  onChange={val => updateCard(card.id, 'apr', val)}
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder="0.00"
                />
                <DetailField
                  label="Stmt Closes (Day)"
                  value={card.statementCloseDay}
                  onChange={val => updateCard(card.id, 'statementCloseDay', val)}
                  min={1}
                  max={28}
                  step={1}
                  placeholder="e.g. 15"
                />
                <DetailField
                  label="Last 4 Digits"
                  type="text"
                  value={card.last4 ?? ''}
                  onChange={val => updateCard(card.id, 'last4', String(val).replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                />
                {/* Payment strategy selector */}
                <label className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Pays
                  </span>
                  <select
                    value={card.paymentStrategy || 'minimum'}
                    onChange={e => updateCard(card.id, 'paymentStrategy', e.target.value)}
                    className="rounded-md px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500/60"
                    style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="minimum">Min Only</option>
                    <option value="full">Full Balance</option>
                    <option value="fixed">Fixed Amt</option>
                  </select>
                </label>
                {card.paymentStrategy === 'fixed' && (
                  <DetailField
                    label="Monthly Pmt"
                    prefix="$"
                    value={card.paymentAmount}
                    onChange={val => updateCard(card.id, 'paymentAmount', val)}
                    min={0}
                    step={10}
                    placeholder="0"
                  />
                )}
                <UtilBadge balance={Number(card.balance) || 0} limit={Number(card.creditLimit) || 0} />
              </div>
            </div>
          )})}

        </div>
      )}

      {/* Add row */}
      <button
        onClick={addCard}
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
        + Add Card
      </button>

      {/* Totals */}
      {cards.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 flex flex-wrap gap-x-5 gap-y-2 text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)' }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Balance owed: </span>
            <span className="font-semibold" style={{ color: '#f87171' }}>{formatCurrency(totalBalance)}</span>
          </div>
          {totalLimit > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Total credit: </span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalLimit)}</span>
            </div>
          )}
          {overallUtil !== null && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Overall util.: </span>
              <span
                className="font-semibold"
                style={{ color: overallUtil >= 90 ? '#f87171' : overallUtil >= 60 ? '#fb923c' : overallUtil >= 30 ? '#facc15' : '#34d399' }}
              >
                {overallUtil}%
              </span>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Payments: </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalEffective)}/mo</span>
            {totalEffective !== totalMinimum && (
              <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>(min {formatCurrency(totalMinimum)})</span>
            )}
          </div>
          {avgApr !== null && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Avg APR: </span>
              <span className="font-semibold" style={{ color: '#fb923c' }}>{avgApr}%</span>
            </div>
          )}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Card payments are added to your monthly expenses based on the selected strategy. Utilization = balance ÷ limit. Drag <span style={{ color: 'var(--text-muted)' }}>⠿</span> to reorder.
      </p>
    </div>
  )
}
