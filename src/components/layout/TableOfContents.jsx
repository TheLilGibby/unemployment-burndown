import { useState, useEffect, useCallback, useRef } from 'react'

const ALL_SECTIONS = [
  { id: 'sec-runway',       label: 'Runway',        sectionKey: null },
  { id: 'sec-chart',        label: 'Chart',         sectionKey: null },
  { id: 'sec-jobs',         label: 'Jobs',          sectionKey: 'jobs' },
  { id: 'sec-savings',      label: 'Savings',       sectionKey: null },
  { id: 'sec-plaid',        label: 'Linked Accts',  sectionKey: 'plaidAccounts' },
  { id: 'sec-unemployment', label: 'Benefits',      sectionKey: null },
  { id: 'sec-whatif',       label: 'What-If',       sectionKey: 'whatif' },
  { id: 'sec-subscriptions',label: 'Subscriptions', sectionKey: 'subscriptions' },
  { id: 'sec-creditcards',  label: 'Credit Cards',  sectionKey: 'creditCards' },
  { id: 'sec-expenses',     label: 'Expenses',      sectionKey: null },
  { id: 'sec-investments',  label: 'Investments',   sectionKey: 'investments' },
  { id: 'sec-onetimes',      label: 'One-Time',      sectionKey: 'onetimes' },
  { id: 'sec-onetimepurchases', label: 'Purchases',  sectionKey: 'onetimePurchases' },
  { id: 'sec-onetimeincome',  label: 'Injections',   sectionKey: 'onetimeIncome' },
  { id: 'sec-monthlyincome', label: 'Mo. Income',   sectionKey: 'monthlyIncome' },
  { id: 'sec-transactions',  label: 'Transactions',  sectionKey: 'transactions' },
  { id: 'sec-assets',        label: 'Assets',        sectionKey: 'assets' },
]

export default function TableOfContents({ visibleSections = {} }) {
  const SECTIONS = ALL_SECTIONS.filter(s =>
    s.sectionKey === null || visibleSections[s.sectionKey] !== false
  )
  const sectionsRef = useRef(SECTIONS)
  sectionsRef.current = SECTIONS

  const [activeId, setActiveId] = useState(null)

  const onScroll = useCallback(() => {
    let current = null
    for (const sec of sectionsRef.current) {
      const el = document.getElementById(sec.id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      // Consider a section "active" once its top is within the top third of the viewport
      if (rect.top <= window.innerHeight * 0.4) current = sec.id
    }
    setActiveId(current)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [onScroll])

  function scrollTo(id) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      className="hidden xl:flex flex-col gap-0.5 fixed top-24 left-4 z-40 w-36"
      aria-label="Page sections"
    >
      <p className="text-xs font-semibold uppercase tracking-widest mb-2 px-2" style={{ color: 'var(--text-muted)' }}>
        Sections
      </p>
      {SECTIONS.map(sec => {
        const isActive = activeId === sec.id
        return (
          <button
            key={sec.id}
            onClick={() => scrollTo(sec.id)}
            className={`text-left text-xs px-2 py-1 rounded-md transition-all truncate ${
              isActive
                ? 'font-semibold'
                : 'hover:opacity-80'
            }`}
            style={{
              color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
              background: isActive ? 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' : 'transparent',
            }}
          >
            {isActive && (
              <span className="inline-block w-1 h-1 rounded-full mr-1.5 mb-0.5 align-middle" style={{ background: 'var(--accent-blue)' }} />
            )}
            {sec.label}
          </button>
        )
      })}
    </nav>
  )
}
