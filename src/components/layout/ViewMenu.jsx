import { useState, useRef, useEffect } from 'react'

// Sections organized by category for the config drawer
const SECTION_GROUPS = [
  {
    label: 'Income & Employment',
    items: [
      { key: 'jobs', label: 'Jobs / Employment' },
      { key: 'monthlyIncome', label: 'Monthly Income' },
      { key: 'onetimeIncome', label: 'One-Time Income' },
    ],
  },
  {
    label: 'Expenses & Debt',
    items: [
      { key: 'subscriptions', label: 'Subscriptions' },
      { key: 'creditCards', label: 'Credit Cards' },
      { key: 'onetimes', label: 'One-Time Expenses' },
      { key: 'onetimePurchases', label: 'One-Time Purchases' },
    ],
  },
  {
    label: 'Assets & Planning',
    items: [
      { key: 'investments', label: 'Investments' },
      { key: 'assets', label: 'Sellable Assets' },
    ],
  },
  {
    label: 'Accounts & Scenarios',
    items: [
      { key: 'plaidAccounts', label: 'Linked Bank Accounts' },
      { key: 'transactions', label: 'Transactions' },
      { key: 'whatif', label: 'What-If Scenarios' },
    ],
  },
]

const CHART_LINE_OPTIONS = [
  { key: 'allExpenses',    label: 'All Expenses',          color: '#3b82f6', dash: null },
  { key: 'essentialsOnly', label: 'Essentials Only',       color: '#a78bfa', dash: '5 3' },
  { key: 'baseline',       label: 'Baseline (no what-if)', color: '#6b7280', dash: '6 4' },
]

const PRESETS = {
  full: {
    label: 'Full',
    desc: 'Everything visible',
    chartLines: { allExpenses: true, essentialsOnly: true, baseline: true },
    sections: { jobs: true, whatif: true, plaidAccounts: true, transactions: true, subscriptions: true, creditCards: true, investments: true, onetimes: true, onetimePurchases: true, onetimeIncome: true, monthlyIncome: true, assets: true },
  },
  essentials: {
    label: 'Essentials',
    desc: 'Savings & core burndown',
    chartLines: { allExpenses: true, essentialsOnly: true, baseline: false },
    sections: { jobs: false, whatif: false, plaidAccounts: false, transactions: false, subscriptions: false, creditCards: false, investments: false, onetimes: false, onetimePurchases: false, onetimeIncome: false, monthlyIncome: false, assets: false },
  },
  income: {
    label: 'Income Focus',
    desc: 'Jobs & income sources',
    chartLines: { allExpenses: true, essentialsOnly: false, baseline: true },
    sections: { jobs: true, whatif: true, plaidAccounts: false, transactions: false, subscriptions: false, creditCards: false, investments: false, onetimes: false, onetimePurchases: false, onetimeIncome: true, monthlyIncome: true, assets: false },
  },
  minimal: {
    label: 'Minimal',
    desc: 'Just the chart',
    chartLines: { allExpenses: true, essentialsOnly: false, baseline: false },
    sections: { jobs: false, whatif: false, plaidAccounts: false, transactions: false, subscriptions: false, creditCards: false, investments: false, onetimes: false, onetimePurchases: false, onetimeIncome: false, monthlyIncome: false, assets: false },
  },
}

/** Detect which preset (if any) matches the current settings */
function getActivePresetKey(value) {
  for (const [key, preset] of Object.entries(PRESETS)) {
    const linesMatch = Object.entries(preset.chartLines).every(([k, v]) => value.chartLines[k] === v)
    const sectionsMatch = Object.entries(preset.sections).every(([k, v]) => value.sections[k] === v)
    if (linesMatch && sectionsMatch) return key
  }
  return null
}

/** iOS-style toggle switch */
function Toggle({ checked, onChange, color }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200"
      style={{ background: checked ? (color || 'var(--accent-blue)') : 'var(--border-subtle)' }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? 'translateX(17px)' : 'translateX(3px)' }}
      />
    </button>
  )
}

export default function ViewMenu({ value, onChange }) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const popoverRef = useRef(null)

  const activePreset = getActivePresetKey(value)
  const activeLabel = activePreset ? PRESETS[activePreset].label : 'Custom'

  const enabledCount = Object.values(value.sections).filter(Boolean).length
  const totalCount = Object.values(value.sections).length

  // Close popover on click outside
  useEffect(() => {
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [drawerOpen])

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [drawerOpen])

  function applyPreset(key) {
    const p = PRESETS[key]
    onChange({ chartLines: { ...p.chartLines }, sections: { ...p.sections } })
    setPopoverOpen(false)
  }

  function toggleChartLine(key) {
    onChange({ ...value, chartLines: { ...value.chartLines, [key]: !value.chartLines[key] } })
  }

  function toggleSection(key) {
    onChange({ ...value, sections: { ...value.sections, [key]: !value.sections[key] } })
  }

  function toggleAllInGroup(group, enable) {
    const newSections = { ...value.sections }
    group.items.forEach(item => { newSections[item.key] = enable })
    onChange({ ...value, sections: newSections })
  }

  return (
    <>
      {/* ── View Switcher Button ── */}
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => { setPopoverOpen(o => !o); setDrawerOpen(false) }}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
          title="Switch view"
          style={{
            borderColor: !activePreset ? 'var(--accent-blue)' : 'var(--border-subtle)',
            background: !activePreset
              ? 'color-mix(in srgb, var(--accent-blue) 10%, var(--bg-input))'
              : 'var(--bg-input)',
            color: !activePreset ? 'var(--accent-blue)' : 'var(--text-secondary)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="1" y="2" width="6" height="5" rx="1" />
            <rect x="9" y="2" width="6" height="5" rx="1" />
            <rect x="1" y="9" width="6" height="5" rx="1" />
            <rect x="9" y="9" width="6" height="5" rx="1" />
          </svg>
          <span className="hidden sm:inline">{activeLabel}</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 4.5l3 3 3-3" />
          </svg>
        </button>

        {/* ── Quick Switcher Popover ── */}
        {popoverOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-2xl z-50 overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="p-1.5">
              {Object.entries(PRESETS).map(([key, preset]) => {
                const isActive = activePreset === key
                return (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, var(--accent-blue) 8%, transparent)'
                        : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-input)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'color-mix(in srgb, var(--accent-blue) 8%, transparent)' : 'transparent' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-medium"
                        style={{ color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)' }}
                      >
                        {preset.label}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {preset.desc}
                      </div>
                    </div>
                    {isActive && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                        <path d="M3 8.5l3 3 7-7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

            <div className="p-1.5">
              <button
                onClick={() => { setPopoverOpen(false); setDrawerOpen(true) }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5.5v5M5.5 8h5" />
                </svg>
                Customize sections...
                <span className="ml-auto text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {enabledCount}/{totalCount}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Full Config Drawer ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Panel */}
          <div
            className="fixed top-0 right-0 bottom-0 z-50 w-80 max-w-[90vw] flex flex-col shadow-2xl"
            style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)' }}
          >
            {/* Drawer header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Customize View
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {enabledCount} of {totalCount} sections visible
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">

              {/* Quick presets */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
                  Quick Presets
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PRESETS).map(([key, preset]) => {
                    const isActive = activePreset === key
                    return (
                      <button
                        key={key}
                        onClick={() => applyPreset(key)}
                        className="text-left px-3 py-2 rounded-lg border transition-colors"
                        style={{
                          borderColor: isActive ? 'var(--accent-blue)' : 'var(--border-subtle)',
                          background: isActive
                            ? 'color-mix(in srgb, var(--accent-blue) 8%, var(--bg-input))'
                            : 'var(--bg-input)',
                          color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        }}
                      >
                        <div className="text-xs font-medium">{preset.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {preset.desc}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

              {/* Chart lines */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  Chart Lines
                </p>
                <div className="space-y-3">
                  {CHART_LINE_OPTIONS.map(({ key, label, color, dash }) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <svg width="24" height="4" viewBox="0 0 24 4">
                          {dash
                            ? <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dash} />
                            : <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth="2.5" />
                          }
                        </svg>
                        <span
                          className="text-xs transition-colors"
                          style={{ color: value.chartLines[key] ? 'var(--text-primary)' : 'var(--text-muted)' }}
                        >
                          {label}
                        </span>
                      </div>
                      <Toggle checked={value.chartLines[key]} onChange={() => toggleChartLine(key)} color={color} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

              {/* Section groups */}
              {SECTION_GROUPS.map((group, gi) => {
                const allEnabled = group.items.every(item => value.sections[item.key])
                return (
                  <div key={group.label}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                        {group.label}
                      </p>
                      <button
                        onClick={() => toggleAllInGroup(group, !allEnabled)}
                        className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                        style={{ color: 'var(--accent-blue)' }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {allEnabled ? 'Hide all' : 'Show all'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {group.items.map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <span
                            className="text-xs transition-colors"
                            style={{ color: value.sections[key] ? 'var(--text-primary)' : 'var(--text-muted)' }}
                          >
                            {label}
                          </span>
                          <Toggle checked={value.sections[key]} onChange={() => toggleSection(key)} />
                        </div>
                      ))}
                    </div>
                    {gi < SECTION_GROUPS.length - 1 && (
                      <div className="mt-6" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
