import dayjs from 'dayjs'
import { formatCurrency } from '../../utils/formatters'

/**
 * SeverancePanel — collects severance package details and shows computed summaries.
 *
 * Props:
 *   value    – severance object (matches DEFAULTS.severance shape)
 *   onChange – (nextValue) => void
 *   baseRunwayMonths  – runway without severance (for extension delta display)
 *   withRunwayMonths  – runway with severance applied (from burndown hook)
 */
export default function SeverancePanel({ value, onChange, baseRunwayMonths = null, withRunwayMonths = null }) {
  function update(field, val) {
    onChange({ ...value, [field]: val })
  }

  // Auto-calculate end date when structure or months changes
  function handleStructureChange(structure) {
    let next = { ...value, paymentStructure: structure }
    if (structure === 'salary_continuation' && next.startDate) {
      next = {
        ...next,
        endDate: dayjs(next.startDate).add(next.continuationMonths || 1, 'month').format('YYYY-MM-DD'),
      }
    } else if (structure === 'lump_sum') {
      next = { ...next, endDate: next.startDate }
    }
    onChange(next)
  }

  function handleStartDateChange(dateStr) {
    let next = { ...value, startDate: dateStr }
    if (value.paymentStructure === 'salary_continuation' && dateStr) {
      next = {
        ...next,
        endDate: dayjs(dateStr).add(value.continuationMonths || 1, 'month').format('YYYY-MM-DD'),
      }
    } else if (value.paymentStructure === 'lump_sum') {
      next = { ...next, endDate: dateStr }
    }
    onChange(next)
  }

  function handleContinuationMonthsChange(months) {
    let next = { ...value, continuationMonths: months }
    if (value.paymentStructure === 'salary_continuation' && value.startDate) {
      next = {
        ...next,
        endDate: dayjs(value.startDate).add(months, 'month').format('YYYY-MM-DD'),
      }
    }
    onChange(next)
  }

  // Computed values
  const grossAmount = Number(value.grossAmount) || 0
  const federalTax = (Number(value.taxWithholdingPct) || 0) / 100
  const stateTax = (Number(value.stateTaxPct) || 0) / 100
  const totalTaxRate = Math.min(federalTax + stateTax, 1)
  const netSeverance = grossAmount * (1 - totalTaxRate)
  const ptoPayout = Number(value.ptoPayout) || 0
  const totalNetIncome = netSeverance + ptoPayout

  const continuationMonths = Number(value.continuationMonths) || 1
  const monthlyNetPayment = value.paymentStructure === 'salary_continuation'
    ? netSeverance / continuationMonths
    : 0

  const runwayExtensionMonths = (withRunwayMonths != null && baseRunwayMonths != null)
    ? Math.max(0, withRunwayMonths - baseRunwayMonths)
    : null

  const inputStyle = {
    background: 'var(--bg-page)',
    border: '1px solid var(--border-input)',
    color: 'var(--text-primary)',
  }

  const labelStyle = { color: 'var(--text-muted)' }

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div className="flex items-center gap-3">
        <button
          role="switch"
          aria-checked={value.enabled}
          onClick={() => update('enabled', !value.enabled)}
          className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            background: value.enabled ? 'var(--accent-emerald)' : 'var(--border-input)',
          }}
        >
          <span
            className="pointer-events-none inline-block h-5 w-5 transform rounded-full shadow transition-transform mt-0.5"
            style={{
              background: 'var(--bg-card)',
              transform: `translateX(${value.enabled ? '1.25rem' : '0.125rem'})`,
            }}
          />
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          I have a severance package
        </span>
      </div>

      {value.enabled && (
        <>
          {/* Gross amount + payment structure */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 font-medium" style={labelStyle}>
                Gross Severance Amount
              </label>
              <div
                className="flex items-center rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)' }}
              >
                <span className="mr-1 text-sm" style={{ color: 'var(--text-secondary)' }}>$</span>
                <input
                  type="number"
                  value={value.grossAmount}
                  onChange={e => update('grossAmount', Number(e.target.value))}
                  className="bg-transparent text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  min="0"
                  step="1000"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={labelStyle}>
                Payment Structure
              </label>
              <select
                value={value.paymentStructure}
                onChange={e => handleStructureChange(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                style={inputStyle}
              >
                <option value="lump_sum">Lump Sum</option>
                <option value="salary_continuation">Salary Continuation</option>
              </select>
            </div>
          </div>

          {/* Salary continuation months (only when relevant) */}
          {value.paymentStructure === 'salary_continuation' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1 font-medium" style={labelStyle}>
                  Continuation Months
                </label>
                <div
                  className="flex items-center rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)' }}
                >
                  <input
                    type="number"
                    value={value.continuationMonths}
                    onChange={e => handleContinuationMonthsChange(Number(e.target.value))}
                    className="bg-transparent text-sm w-full outline-none"
                    style={{ color: 'var(--text-primary)' }}
                    min="1"
                    max="60"
                  />
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>mo</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs mb-1 font-medium" style={labelStyle}>
                  Monthly Net Payment
                </label>
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                >
                  <span className="font-semibold sensitive" style={{ color: 'var(--accent-emerald)' }}>
                    {formatCurrency(monthlyNetPayment)}/mo
                  </span>
                  <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                    net after taxes
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tax withholding */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 font-medium" style={labelStyle}>
                Federal Withholding Rate
              </label>
              <div
                className="flex items-center rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)' }}
              >
                <input
                  type="number"
                  value={value.taxWithholdingPct}
                  onChange={e => update('taxWithholdingPct', Number(e.target.value))}
                  className="bg-transparent text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  min="0"
                  max="100"
                  step="0.5"
                />
                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                Supplemental federal rate is 22% for most.
              </p>
            </div>

            <div>
              <label className="block text-xs mb-1 font-medium" style={labelStyle}>
                State Tax Rate
              </label>
              <div
                className="flex items-center rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)' }}
              >
                <input
                  type="number"
                  value={value.stateTaxPct}
                  onChange={e => update('stateTaxPct', Number(e.target.value))}
                  className="bg-transparent text-sm w-full outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  min="0"
                  max="20"
                  step="0.1"
                />
                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                Check your state's supplemental income rate.
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 font-medium" style={labelStyle}>
                Severance Start Date
              </label>
              <input
                type="date"
                value={value.startDate}
                onChange={e => handleStartDateChange(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                style={inputStyle}
              />
            </div>

            {value.paymentStructure === 'salary_continuation' && (
              <div>
                <label className="block text-xs mb-1 font-medium" style={labelStyle}>
                  Severance End Date
                </label>
                <input
                  type="date"
                  value={value.endDate}
                  onChange={e => update('endDate', e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/60"
                  style={inputStyle}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                  Auto-calculated from start date + continuation months.
                </p>
              </div>
            )}
          </div>

          {/* PTO payout */}
          <div>
            <label className="block text-xs mb-1 font-medium" style={labelStyle}>
              PTO Payout (After Tax)
            </label>
            <div
              className="flex items-center rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-blue-500/60"
              style={{ background: 'var(--bg-page)', border: '1px solid var(--border-input)' }}
            >
              <span className="mr-1 text-sm" style={{ color: 'var(--text-secondary)' }}>$</span>
              <input
                type="number"
                value={value.ptoPayout}
                onChange={e => update('ptoPayout', Number(e.target.value))}
                className="bg-transparent text-sm w-full outline-none"
                style={{ color: 'var(--text-primary)' }}
                min="0"
                step="100"
                placeholder="0"
              />
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
              Paid out on start date alongside severance. Enter the net amount after taxes.
            </p>
          </div>

          {/* Boolean flags */}
          <div className="space-y-3">
            {/* Health insurance continuation */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value.includesHealthInsurance}
                onChange={e => update('includesHealthInsurance', e.target.checked)}
                className="mt-0.5 flex-shrink-0"
              />
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Health insurance continues during severance
                </span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  Informational only — reduce your Health/Insurance expense manually if applicable.
                </p>
              </div>
            </label>

            {/* Delays unemployment eligibility */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value.delaysUnemployment}
                onChange={e => update('delaysUnemployment', e.target.checked)}
                className="mt-0.5 flex-shrink-0"
              />
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Severance delays unemployment eligibility
                </span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                  In many states, salary continuation severance delays UI benefit start. The burndown
                  will push your unemployment start date to after severance ends.
                </p>
              </div>
            </label>
          </div>

          {/* Computed summary card */}
          {grossAmount > 0 && (
            <div
              className="rounded-lg px-4 py-3 space-y-2 text-sm"
              style={{
                background: 'color-mix(in srgb, var(--accent-emerald) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent)',
              }}
            >
              <div className="font-semibold text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--accent-emerald)' }}>
                Severance Summary
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Gross: </span>
                  <span className="font-semibold sensitive" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(grossAmount)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Tax rate: </span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {Math.round(totalTaxRate * 100)}%
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Net severance: </span>
                  <span className="font-semibold sensitive" style={{ color: 'var(--accent-emerald)' }}>
                    {formatCurrency(netSeverance)}
                  </span>
                </div>
                {ptoPayout > 0 && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>+ PTO payout: </span>
                    <span className="font-semibold sensitive" style={{ color: 'var(--accent-emerald)' }}>
                      {formatCurrency(ptoPayout)}
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Total net income: </span>
                  <span className="font-semibold sensitive" style={{ color: 'var(--accent-emerald)' }}>
                    {formatCurrency(totalNetIncome)}
                  </span>
                </div>
                {value.paymentStructure === 'salary_continuation' && (
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Monthly payment: </span>
                    <span className="font-semibold sensitive" style={{ color: 'var(--accent-emerald)' }}>
                      {formatCurrency(monthlyNetPayment)}/mo
                    </span>
                  </div>
                )}
              </div>

              {runwayExtensionMonths !== null && runwayExtensionMonths > 0 && (
                <div
                  className="mt-2 rounded px-3 py-2 text-sm font-medium"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-emerald) 15%, transparent)',
                    color: 'var(--accent-emerald)',
                  }}
                >
                  Severance extends your runway by{' '}
                  {runwayExtensionMonths < 1
                    ? `~${Math.round(runwayExtensionMonths * 30)} days`
                    : `~${runwayExtensionMonths.toFixed(1)} months`}
                </div>
              )}

              {value.delaysUnemployment && value.endDate && (
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Unemployment benefits delayed until after {dayjs(value.endDate).format('MMM D, YYYY')}
                </div>
              )}

              {value.includesHealthInsurance && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Health insurance included during severance period
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        {value.enabled
          ? 'Severance income is added to the burndown simulation during the severance period. For salary continuation, income is spread evenly across the months.'
          : 'Enable severance to model how a package extends your financial runway.'}
      </p>
    </div>
  )
}
