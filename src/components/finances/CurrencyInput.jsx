import { useState } from 'react'

function formatNum(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '0'
  const num = Number(n)
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function CurrencyInput({ value, onChange, className, style, placeholder, min }) {
  const [focused, setFocused] = useState(false)
  const [editValue, setEditValue] = useState('')

  function handleFocus() {
    setFocused(true)
    setEditValue(value === 0 || value == null ? '' : String(value))
  }

  function handleChange(e) {
    const raw = e.target.value
    setEditValue(raw)
    const stripped = raw.replace(/,/g, '')
    const parsed = parseFloat(stripped)
    if (!isNaN(parsed)) {
      onChange(parsed)
    } else if (stripped === '') {
      onChange(0)
    }
  }

  function handleBlur() {
    setFocused(false)
    const stripped = editValue.replace(/,/g, '')
    const parsed = parseFloat(stripped)
    const num = isNaN(parsed) ? 0 : parsed
    const minNum = min != null ? Number(min) : 0
    onChange(Math.max(minNum, num))
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={focused ? editValue : formatNum(value)}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`${className || ''} sensitive`}
      style={style}
      placeholder={placeholder ?? '0'}
    />
  )
}
