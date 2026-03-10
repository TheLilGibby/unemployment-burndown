import { useState, useEffect } from 'react'
import CurrencyInput from '../finances/CurrencyInput'
import AssigneeSelect from '../people/AssigneeSelect'

const ICONS = [
  { key: 'home',       label: 'Home' },
  { key: 'car',        label: 'Car' },
  { key: 'plane',      label: 'Travel' },
  { key: 'baby',       label: 'Family' },
  { key: 'piggy',      label: 'Savings' },
  { key: 'chart',      label: 'Invest' },
  { key: 'creditcard', label: 'Debt' },
  { key: 'shield',     label: 'Safety' },
]

const ICON_PATHS = {
  home: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />,
  car: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />,
  plane: <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />,
  baby: <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />,
  piggy: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  chart: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />,
  creditcard: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />,
  shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />,
}

const COLORS = [
  { key: 'blue',    bg: '#3b82f6' },
  { key: 'emerald', bg: '#10b981' },
  { key: 'amber',   bg: '#f59e0b' },
  { key: 'purple',  bg: '#8b5cf6' },
  { key: 'rose',    bg: '#f43f5e' },
  { key: 'cyan',    bg: '#06b6d4' },
]

const CATEGORIES = [
  { value: 'savings',     label: 'Savings' },
  { value: 'investment',  label: 'Investment' },
  { value: 'debt-payoff', label: 'Debt Payoff' },
  { value: 'custom',      label: 'Custom' },
]

const DATA_SOURCE_TYPES = [
  { value: 'manual',          label: 'Track manually' },
  { value: 'savingsAccounts', label: 'Link to savings account(s)' },
  { value: 'investmentTotal', label: 'Link to investments' },
  { value: 'debtPayoff',      label: 'Link to credit card payoff' },
]

function makeDefault() {
  return {
    id: crypto.randomUUID(),
    name: '',
    icon: 'piggy',
    targetAmount: 0,
    currentAmount: 0,
    targetDate: '',
    category: 'savings',
    dataSource: { type: 'manual', accountIds: [] },
    monthlyContribution: 0,
    notes: '',
    createdAt: new Date().toISOString(),
    assignedTo: null,
    color: 'emerald',
    pinned: false,
  }
}

export default function GoalFormModal({ goal, onSave, onClose, savingsAccounts = [], investments = [], creditCards = [], people = [] }) {
  const [form, setForm] = useState(() => goal ? { ...makeDefault(), ...goal } : makeDefault())

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }))
  }

  function setDataSourceType(type) {
    setForm(f => ({ ...f, dataSource: { type, accountIds: [] } }))
  }

  function toggleAccountId(id) {
    setForm(f => {
      const ids = f.dataSource.accountIds || []
      const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
      return { ...f, dataSource: { ...f.dataSource, accountIds: next } }
    })
  }

  const [validationErrors, setValidationErrors] = useState({})

  function handleSave() {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Goal name is required.'
    if (!form.targetAmount || form.targetAmount <= 0) errors.targetAmount = 'Target amount must be greater than 0.'
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }
    setValidationErrors({})
    onSave(form)
  }

  const dsType = form.dataSource?.type || 'manual'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" role="button" tabIndex={-1} aria-label="Close modal" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog" aria-modal="true" className="theme-card rounded-2xl border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {goal ? 'Edit Goal' : 'New Goal'}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Goal name */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Goal Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Down payment on a home"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
                autoFocus
              />
              {validationErrors.name && <p className="text-xs mt-1" style={{ color: 'var(--red, #ef4444)' }}>{validationErrors.name}</p>}
            </div>

            {/* Icon picker */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Icon
              </label>
              <div className="grid grid-cols-4 gap-2">
                {ICONS.map(({ key, label }) => {
                  const selected = form.icon === key
                  const c = COLORS.find(x => x.key === form.color)?.bg || '#10b981'
                  return (
                    <button
                      key={key}
                      onClick={() => set('icon', key)}
                      className="flex flex-col items-center gap-1 py-2 rounded-lg border transition-all"
                      style={{
                        borderColor: selected ? c : 'var(--border-subtle)',
                        background: selected ? `color-mix(in srgb, ${c} 10%, var(--bg-input))` : 'var(--bg-input)',
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={selected ? c : 'var(--text-muted)'} className="w-5 h-5">
                        {ICON_PATHS[key]}
                      </svg>
                      <span className="text-[10px]" style={{ color: selected ? c : 'var(--text-muted)' }}>{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Color
              </label>
              <div className="flex gap-2">
                {COLORS.map(({ key, bg }) => (
                  <button
                    key={key}
                    onClick={() => set('color', key)}
                    className="w-8 h-8 rounded-full transition-all flex items-center justify-center"
                    style={{
                      background: bg,
                      outline: form.color === key ? `2px solid ${bg}` : 'none',
                      outlineOffset: '2px',
                    }}
                  >
                    {form.color === key && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M3 8.5l3 3 7-7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Target amount */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Target Amount
              </label>
              <div
                className="flex items-center rounded-lg border px-3 py-2 transition-colors"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
              >
                <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                <CurrencyInput
                  value={form.targetAmount}
                  onChange={val => set('targetAmount', val)}
                  className="bg-transparent text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  min="0"
                />
              </div>
              {validationErrors.targetAmount && <p className="text-xs mt-1" style={{ color: 'var(--red, #ef4444)' }}>{validationErrors.targetAmount}</p>}
            </div>

            {/* Target date */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Target Date <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <input
                type="date"
                value={form.targetDate}
                onChange={e => set('targetDate', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Category
              </label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Data source */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Track Progress
              </label>
              <select
                value={dsType}
                onChange={e => setDataSourceType(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {DATA_SOURCE_TYPES.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>

              {/* Account multi-select for savings */}
              {dsType === 'savingsAccounts' && savingsAccounts.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Select savings accounts to track:</p>
                  {savingsAccounts.map(acc => {
                    const checked = (form.dataSource.accountIds || []).includes(acc.id)
                    return (
                      <label key={acc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors" style={{ background: checked ? 'var(--bg-input)' : 'transparent' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAccountId(acc.id)}
                          className="rounded"
                        />
                        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{acc.name}</span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                          ${(Number(acc.amount) || 0).toLocaleString()}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* Account multi-select for debt payoff */}
              {dsType === 'debtPayoff' && creditCards.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Select credit cards to track payoff:</p>
                  {creditCards.map(cc => {
                    const checked = (form.dataSource.accountIds || []).includes(cc.id)
                    return (
                      <label key={cc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors" style={{ background: checked ? 'var(--bg-input)' : 'transparent' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAccountId(cc.id)}
                          className="rounded"
                        />
                        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{cc.name || `Card ending ${cc.lastFour || '****'}`}</span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                          ${(Number(cc.balance) || 0).toLocaleString()} bal
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              {dsType === 'investmentTotal' && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  Tracks the total monthly investment amount across all active investments.
                </p>
              )}

              {/* Manual current amount */}
              {dsType === 'manual' && (
                <div className="mt-2">
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Current progress amount:</label>
                  <div
                    className="flex items-center rounded-lg border px-3 py-2 transition-colors"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
                  >
                    <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                    <CurrencyInput
                      value={form.currentAmount}
                      onChange={val => set('currentAmount', val)}
                      className="bg-transparent text-sm w-full outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      min="0"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Monthly contribution */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Monthly Contribution <span style={{ color: 'var(--text-muted)' }}>(planned)</span>
              </label>
              <div
                className="flex items-center rounded-lg border px-3 py-2 transition-colors"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border-subtle)' }}
              >
                <span className="text-sm mr-1" style={{ color: 'var(--text-muted)' }}>$</span>
                <CurrencyInput
                  value={form.monthlyContribution}
                  onChange={val => set('monthlyContribution', val)}
                  className="bg-transparent text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  min="0"
                />
                <span className="text-xs ml-1 shrink-0" style={{ color: 'var(--text-muted)' }}>/mo</span>
              </div>
            </div>

            {/* Assignee */}
            {people.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Assigned To
                </label>
                <div className="flex items-center gap-2">
                  <AssigneeSelect
                    people={people}
                    value={form.assignedTo}
                    onChange={val => set('assignedTo', val)}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {form.assignedTo
                      ? people.find(p => p.id === form.assignedTo)?.name || 'Assigned'
                      : 'Unassigned — click to assign'}
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder="Any additional context or reminders..."
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors resize-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || !form.targetAmount}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40"
                style={{ background: COLORS.find(x => x.key === form.color)?.bg || '#10b981' }}
              >
                {goal ? 'Save Changes' : 'Create Goal'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-sm transition-colors border"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-input)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
