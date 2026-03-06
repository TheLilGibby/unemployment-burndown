import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const BASE_TABS = [
  { path: '/',              label: 'Overview',      shortLabel: 'Home' },
  { path: '/job-scenarios', label: 'Job Scenarios', shortLabel: 'Jobs' },
  { path: '/credit-cards',  label: 'Statements',    shortLabel: 'Cards' },
  { path: '/retirement',    label: 'Retirement',    shortLabel: 'Retire' },
  { path: '/goals',         label: 'Goals',         shortLabel: 'Goals' },
]

const ADMIN_TAB = { path: '/admin', label: 'Admin', shortLabel: 'Admin' }

export default function Header({ rightSlot, isSuperAdmin }) {
  const location = useLocation()
  const navigate = useNavigate()
  const activePath = location.pathname.replace(/\/+$/, '') || '/'

  const tabs = useMemo(() =>
    isSuperAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS,
    [isSuperAdmin],
  )
  const [visible, setVisible] = useState(true)
  const lastScrollY = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(() => {
        const currentY = window.scrollY
        if (currentY < 10 || currentY < lastScrollY.current) {
          setVisible(true)
        } else if (currentY > lastScrollY.current) {
          setVisible(false)
        }
        lastScrollY.current = currentY
        ticking.current = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 flex items-center justify-between px-2 sm:px-5
        backdrop-blur-xl backdrop-saturate-150
        transition-transform duration-300 ease-in-out
        ${visible ? 'translate-y-0' : '-translate-y-full'}`}
      style={{
        backgroundColor: 'var(--header-bg)',
        borderBottom: '1px solid var(--border-subtle)',
        height: 44,
      }}
    >
      <nav className="flex items-center">
        {tabs.map(tab => {
          const isActive = activePath === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative h-[44px] px-1.5 sm:px-3 text-[13px] font-medium transition-colors whitespace-nowrap"
              style={{ color: isActive ? 'var(--accent-blue, #3b82f6)' : 'var(--text-muted)' }}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {isActive && (
                <span
                  className="absolute bottom-0 inset-x-1.5 sm:inset-x-3 h-0.5 rounded-full"
                  style={{ background: 'var(--accent-blue, #3b82f6)' }}
                />
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex items-center gap-1">
        {rightSlot}
      </div>
    </header>
  )
}
