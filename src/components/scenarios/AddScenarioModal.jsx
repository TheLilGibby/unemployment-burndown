import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'
import { US_STATES, getStateTaxRate, computeMonthlyTakeHome } from '../../utils/stateTaxRates'
import CurrencyInput from '../finances/CurrencyInput'
import dayjs from 'dayjs'

const today = dayjs()
const minDate = today.add(1, 'day').format('YYYY-MM-DD')

export default function AddScenarioModal({ onAdd, onClose }) {
  const [name, setName] = useState('')
  const [gross, setGross] = useState(0)
  const [usState, setUsState] = useState('')
  const [taxRate, setTaxRate] = useState(0)
  const [startDate, setStartDate] = useState('')
  const [savings, setSavings] = useState(0)
  const [savingsType, setSavingsType] = useState('dollar')
  const [investment, setInvestment] = useState(0)
  const [investmentType, setInvestmentType] = useState('dollar')
  const [annualRaise, setAnnualRaise] = useState(3)
  const [signingBonus, setSigningBonus] = useState(0)
  const [annualBonusPct, setAnnualBonusPct] = useState(0)
  const [benefitsMonthly, setBenefitsMonthly] = useState(0)
  const [employerMatch, setEmployerMatch] = useState(0)
  const [equityAnnual, setEquityAnnual] = useState(0)
  const [commuteMonthly, setCommuteMonthly] = useState(0)
  const [showCompPkg, setShowCompPkg] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const takeHome = computeMonthlyTakeHome(gross, taxRate)
  const canSubmit = name.trim() && gross > 0 && startDate

  function handleSubmit() {
    if (!canSubmit) return
    onAdd({
      name: name.trim(),
      grossAnnualSalary: gross,
      usState,
      taxRatePct: taxRate,
      monthlyTakeHome: takeHome,
      startDate,
      savingsAllocation: savings,
      savingsAllocationType: savingsType,
      investmentAllocation: investment,
      investmentAllocationType: investmentType,
      annualRaisePct: annualRaise,
      signingBonus,
      annualBonusPct,
      employerBenefitsMonthly: benefitsMonthly,
      employer401kMatchPct: employerMatch,
      equityAnnual,
      commuteMonthly,
    })
  }

  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="theme-card rounded-2xl border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Add Scenario
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
            {/* Row 1: Name, Gross, Start Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Company A - Sr Dev"
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Gross Annual Salary ($)</label>
                <CurrencyInput
                  value={gross}
                  onChange={setGross}
                  placeholder="e.g. 120,000"
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={inputStyle}
                />
                {gross > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    Take-home: {formatCurrency(takeHome)}/mo
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Start Date</label>
                <input
                  type="date"
                  min={minDate}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={inputStyle}
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[1, 2, 3, 6].map(mo => {
                    const d = today.add(mo, 'month').format('YYYY-MM-DD')
                    return (
                      <button
                        key={mo}
                        type="button"
                        onClick={() => setStartDate(d)}
                        className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                        style={{
                          borderColor: startDate === d ? 'var(--accent-blue)' : 'var(--border-subtle)',
                          background: startDate === d ? 'var(--accent-blue)' + '20' : 'transparent',
                          color: startDate === d ? 'var(--accent-blue)' : 'var(--text-faint)',
                        }}
                      >
                        +{mo}mo
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Row 2: State, Tax Rate, Annual Raise */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>US State</label>
                <select
                  value={usState}
                  onChange={e => {
                    setUsState(e.target.value)
                    setTaxRate(getStateTaxRate(e.target.value))
                  }}
                  className="w-full text-sm rounded px-2 py-1.5 pr-7 focus:outline-none themed-select"
                  style={inputStyle}
                >
                  <option value="">Select state...</option>
                  {US_STATES.map(st => (
                    <option key={st.code} value={st.code}>{st.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Tax Rate %</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  value={taxRate}
                  onChange={e => setTaxRate(Number(e.target.value))}
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Annual Raise %</label>
                <input
                  type="number"
                  min="0"
                  max="25"
                  step="0.5"
                  value={annualRaise}
                  onChange={e => setAnnualRaise(Number(e.target.value))}
                  className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                  style={inputStyle}
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[0, 2, 3, 5, 8].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAnnualRaise(pct)}
                      className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                      style={{
                        borderColor: annualRaise === pct ? 'var(--accent-blue)' : 'var(--border-subtle)',
                        background: annualRaise === pct ? 'var(--accent-blue)' + '20' : 'transparent',
                        color: annualRaise === pct ? 'var(--accent-blue)' : 'var(--text-faint)',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 3: Allocation fields */}
            <div className="grid grid-cols-2 gap-3">
              <AllocationField
                label="Savings Allocation"
                value={savings}
                type={savingsType}
                onValueChange={setSavings}
                onTypeChange={setSavingsType}
                takeHome={takeHome}
                color="#f59e0b"
              />
              <AllocationField
                label="Investment Allocation"
                value={investment}
                type={investmentType}
                onValueChange={setInvestment}
                onTypeChange={setInvestmentType}
                takeHome={takeHome}
                color="#a855f7"
              />
            </div>

            {/* Compensation Package (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowCompPkg(prev => !prev)}
                className="flex items-center gap-1.5 text-xs font-medium w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                <ChevronRight
                  size={12}
                  strokeWidth={2.5}
                  className="transition-transform duration-200"
                  style={{ transform: showCompPkg ? 'rotate(90deg)' : 'rotate(0deg)' }}
                />
                Compensation Package
                {(signingBonus > 0 || annualBonusPct > 0 || benefitsMonthly > 0 ||
                  employerMatch > 0 || equityAnnual > 0 || commuteMonthly > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full ml-1" style={{ background: '#10b981', display: 'inline-block' }} />
                )}
              </button>
              {showCompPkg && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Signing Bonus</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={signingBonus}
                        onChange={setSigningBonus}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>one-time at start</p>
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Annual Bonus %</label>
                    <input
                      type="number" min="0" max="100" step="1"
                      value={annualBonusPct}
                      onChange={e => setAnnualBonusPct(Number(e.target.value))}
                      className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Benefits Value/mo</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={benefitsMonthly}
                        onChange={setBenefitsMonthly}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>offsets insurance costs</p>
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>401k Match %</label>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={employerMatch}
                      onChange={e => setEmployerMatch(Number(e.target.value))}
                      className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Equity/RSU Annual</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={equityAnnual}
                        onChange={setEquityAnnual}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Commute Cost/mo</label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>
                      <CurrencyInput
                        value={commuteMonthly}
                        onChange={setCommuteMonthly}
                        className="w-full text-sm rounded px-2 py-1.5 focus:outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'var(--accent-emerald)' }}
              >
                + Add Scenario
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

function AllocationField({ label, value, type, onValueChange, onTypeChange, takeHome, color }) {
  const resolvedAmount = type === 'percent' ? (takeHome * value / 100) : value

  return (
    <div>
      <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="flex items-center gap-1">
        {type === 'dollar' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$</span>}
        <input
          type="number"
          min="0"
          step={type === 'percent' ? 1 : 50}
          max={type === 'percent' ? 100 : undefined}
          value={value}
          onChange={e => onValueChange(Number(e.target.value))}
          className="flex-1 text-sm rounded px-2 py-1.5 focus:outline-none"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        />
        {type === 'percent' && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>}
        <div className="flex rounded-md overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
          <button
            type="button"
            onClick={() => onTypeChange('dollar')}
            className="text-xs px-2 py-1 transition-colors"
            style={{
              background: type === 'dollar' ? color + '30' : 'var(--bg-input)',
              color: type === 'dollar' ? color : 'var(--text-faint)',
            }}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => onTypeChange('percent')}
            className="text-xs px-2 py-1 transition-colors"
            style={{
              background: type === 'percent' ? color + '30' : 'var(--bg-input)',
              color: type === 'percent' ? color : 'var(--text-faint)',
            }}
          >
            %
          </button>
        </div>
      </div>
      {type === 'percent' && value > 0 && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
          = {formatCurrency(resolvedAmount)}/mo
        </p>
      )}
    </div>
  )
}
