import { useState } from 'react'

export default function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    if (!key) return defaultValue
    try {
      const stored = localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  function setPersistedValue(val) {
    const next = typeof val === 'function' ? val(value) : val
    if (key) localStorage.setItem(key, JSON.stringify(next))
    setValue(next)
  }

  return [value, setPersistedValue]
}
