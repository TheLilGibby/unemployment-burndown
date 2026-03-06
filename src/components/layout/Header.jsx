import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Briefcase, CreditCard, PiggyBank, Target, ShieldCheck } from 'lucide-react'
import goragLogo from '../../assets/gorag-logo.svg'

const BASE_TABS = [
  { path: '/',              label: 'Overview',      shortLabel: 'Home',   icon: Home },
  { path: '/job-scenarios', label: 'Job Scenarios', shortLabel: 'Jobs',   icon: Briefcase },
  { path: '/credit-cards',  label: 'Statements',    shortLabel: 'Cards',  icon: CreditCard },
  { path: '/retirement',    label: 'Retirement',    shortLabel: 'Retire', icon: PiggyBank },
  { path: '/goals',         label: 'Goals',         shortLabel: 'Goals',  icon: Target },
]

const ADMIN_TAB = { path: '/admin', label: 'Admin', shortLabel: 'Admin', icon: ShieldCheck }

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
    <>
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
          <img
            src={goragLogo}
            alt="GoRAG"
            className="h-6 mr-3 cursor-pointer"
            onClick={() => navigate('/')}
          />
          <div className="hidden sm:flex items-center">
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
          </div>
        </nav>

        <div className="flex items-center gap-1">
          {rightSlot}
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className={`fixed bottom-0 inset-x-0 z-50 sm:hidden
          flex items-stretch justify-around
          backdrop-blur-xl backdrop-saturate-150
          transition-transform duration-300 ease-in-out
          ${visible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{
          backgroundColor: 'var(--header-bg)',
          borderTop: '1px solid var(--border-subtle)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {tabs.map(tab => {
          const isActive = activePath === tab.path
          const Icon = tab.icon
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors"
              style={{ color: isActive ? 'var(--accent-blue, #3b82f6)' : 'var(--text-muted)' }}
            >
              {isActive && (
                <span
                  className="absolute top-0 inset-x-2 h-0.5 rounded-full"
                  style={{ background: 'var(--accent-blue, #3b82f6)' }}
                />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="text-[10px] font-medium leading-tight">{tab.shortLabel}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
