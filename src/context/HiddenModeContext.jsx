import { createContext, useContext, useEffect, useState } from 'react'

const HiddenModeContext = createContext(null)

const STORAGE_KEY = 'burndown-hidden-mode'

export function HiddenModeProvider({ children }) {
  const [hidden, setHiddenState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    if (hidden) {
      document.documentElement.setAttribute('data-hidden-mode', 'true')
    } else {
      document.documentElement.removeAttribute('data-hidden-mode')
    }
  }, [hidden])

  function setHidden(val) {
    localStorage.setItem(STORAGE_KEY, String(val))
    setHiddenState(val)
  }

  function toggleHidden() {
    setHidden(!hidden)
  }

  return (
    <HiddenModeContext.Provider value={{ hidden, setHidden, toggleHidden }}>
      {children}
    </HiddenModeContext.Provider>
  )
}

export function useHiddenMode() {
  const ctx = useContext(HiddenModeContext)
  if (!ctx) throw new Error('useHiddenMode must be used inside HiddenModeProvider')
  return ctx
}
