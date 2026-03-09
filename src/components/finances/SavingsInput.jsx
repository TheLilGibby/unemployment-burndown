import { useState } from 'react'
import { formatCurrency } from '../../utils/formatters'

export default function SavingsInput({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  function startEdit() {
    setRaw(String(value))
    setEditing(true)
  }

  function commitEdit() {
    const parsed = parseFloat(raw.replace(/[^0-9.]/g, ''))
    if (!isNaN(parsed) && parsed >= 0) onChange(parsed)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Current Savings / Cash on Hand</label>
        {editing ? (
          <div
            className="flex items-center rounded-lg px-3 py-2"
            style={{
              background: 'var(--bg-page)',
              border: '1px solid var(--accent-blue)',
            }}
          >
            <span className="mr-1 text-lg" style={{ color: 'var(--text-secondary)' }}>$</span>
            <input
              className="bg-transparent text-2xl font-bold w-full outline-none"
              style={{ color: 'var(--text-primary)' }}
              type="number"
              value={raw}
              onChange={e => setRaw(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => e.key === 'Enter' && commitEdit()}
              autoFocus
              min="0"
            />
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="text-left w-full rounded-lg px-3 py-2 transition-colors group"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-input)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-input)'}
          >
            <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(value)}</span>
            <span className="ml-2 text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>click to edit</span>
          </button>
        )}
      </div>
    </div>
  )
}
