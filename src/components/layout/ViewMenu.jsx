import { useState, useRef, useEffect } from 'react'

// Sections that can be toggled (runway, chart, savings, unemployment, expenses are always shown)
const SECTION_OPTIONS = [
  { key: 'jobs',         label: 'Jobs / Employment' },
  { key: 'whatif',       label: 'What-If Scenarios' },
  { key: 'plaidAccounts',label: 'Linked Accounts' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'subscriptions',label: 'Subscriptions' },
  { key: 'creditCards',  label: 'Credit Cards' },
  { key: 'investments',  label: 'Investments' },
  { key: 'onetimes',     label: 'One-Time Expenses' },
  { key: 'onetimePurchases', label: 'One-Time Purchases' },
  { key: 'onetimeIncome',  label: 'One-Time Income' },
  { key: 'monthlyIncome', label: 'Monthly Income' },
  { key: 'assets',        label: 'Sellable Assets' },
  { key: 'retirement',   label: 'Retirement Planning' },
]

const CHART_LINE_OPTIONS = [
  { key: 'allExpenses',   label: 'All Expenses',          color: '#3b82f6', dash: null },
  { key: 'essentialsOnly',label: 'Essentials Only',       color: '#a78bfa', dash: '5 3' },
  { key: 'baseline',      label: 'Baseline (no what-if)', color: '#6b7280', dash: '6 4' },
]

const PRESETS = {
  full: {
    label: 'Full',
    chartLines: { allExpenses: true, essentialsOnly: true, baseline: true },
    sections:   { jobs: true, whatif: true, plaidAccounts: true, transactions: true, subscriptions: true, creditCards: true, investments: true, onetimes: true, onetimePurchases: true, onetimeIncome: true, monthlyIncome: true, assets: true, retirement: true },
  },
  essentials: {
    label: 'Essentials',
    chartLines: { allExpenses: true, essentialsOnly: true, baseline: false },
    sections:   { jobs: false, whatif: false, plaidAccounts: false, transactions: false, subscriptions: false, creditCards: false, investments: false, onetimes: false, onetimePurchases: false, onetimeIncome: false, monthlyIncome: false, assets: false, retirement: false },
  },
  income: {
    label: 'Income Focus',
    chartLines: { allExpenses: true, essentialsOnly: false, baseline: true },
    sections:   { jobs: true, whatif: true, plaidAccounts: false, transactions: false, subscriptions: false, creditCards: false, investments: false, onetimes: false, onetimePurchases: false, onetimeIncome: true, monthlyIncome: true, assets: false, retirement: false },
  },
  minimal: {
    label: 'Minimal',
    chartLines: { allExpenses: true, essentialsOnly: false, baseline: false },
    sections:   { jobs: false, whatif: false, plaidAccounts: false, transactions: false, subscriptions: false, creditCards: false, investments: false, onetimes: false, onetimePurchases: false, onetimeIncome: false, monthlyIncome: false, assets: false, retirement: false },
  },
}

export default function ViewMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleChartLine(key) {
    onChange({ ...value, chartLines: { ...value.chartLines, [key]: !value.chartLines[key] } })
  }

  function toggleSection(key) {
    onChange({ ...value, sections: { ...value.sections, [key]: !value.sections[key] } })
  }

  function applyPreset(presetKey) {
    const p = PRESETS[presetKey]
    onChange({ chartLines: { ...p.chartLines }, sections: { ...p.sections } })
  }

  const hiddenSections = Object.values(value.sections).filter(v => !v).length
  const hiddenLines    = Object.entries(value.chartLines).filter(([k, v]) => !v).length
  const totalHidden    = hiddenSections + hiddenLines

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
        style={{ color: totalHidden > 0 ? 'var(--accent-blue, #3b82f6)' : 'var(--text-muted)' }}
        title="Customize views and visible sections"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="1" y="2" width="6" height="5" rx="1" />
          <rect x="9" y="2" width="6" height="5" rx="1" />
          <rect x="1" y="9" width="6" height="5" rx="1" />
          <rect x="9" y="9" width="6" height="5" rx="1" />
        </svg>
        {totalHidden > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold"
            style={{ background: 'var(--accent-blue)', color: '#fff' }}
          >
            {totalHidden}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-2xl z-50 p-4 space-y-4"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          {/* Preset views */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              Preset Views
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className="text-xs px-2 py-1.5 rounded-lg border transition-colors text-left"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--bg-input)' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-blue)'
                    e.currentTarget.style.color = 'var(--accent-blue)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

          {/* Chart lines */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              Chart Goals
            </p>
            <div className="space-y-2">
              {CHART_LINE_OPTIONS.map(({ key, label, color, dash }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={value.chartLines[key]}
                    onChange={() => toggleChartLine(key)}
                    className="rounded"
                    style={{ accentColor: color }}
                  />
                  <svg width="20" height="4" viewBox="0 0 20 4">
                    {dash
                      ? <line x1="0" y1="2" x2="20" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dash} />
                      : <line x1="0" y1="2" x2="20" y2="2" stroke={color} strokeWidth="2.5" />
                    }
                  </svg>
                  <span
                    className="text-xs transition-colors"
                    style={{ color: value.chartLines[key] ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

          {/* Page sections */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              Page Sections
            </p>
            <div className="space-y-2">
              {SECTION_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={value.sections[key]}
                    onChange={() => toggleSection(key)}
                    className="rounded"
                  />
                  <span
                    className="text-xs transition-colors"
                    style={{ color: value.sections[key] ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
