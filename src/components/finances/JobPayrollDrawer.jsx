import { useMemo } from 'react'
import { Briefcase, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

/**
 * Expandable drawer that shows payroll transactions linked to a specific job.
 * Rendered inline beneath a job row in JobsPanel.
 */
export default function JobPayrollDrawer({ job, allTransactions, transactionOverrides, open, onToggle }) {
  const jobId = job.jobId || job.id

  // Find all transactions tagged as payroll for this job
  const payrollTxns = useMemo(() => {
    if (!allTransactions?.length || !transactionOverrides) return []
    return allTransactions
      .filter(txn => {
        const override = transactionOverrides[txn.id]
        return override?.isPayroll && override?.payrollJobId === jobId
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [allTransactions, transactionOverrides, jobId])

  const totalPayroll = useMemo(
    () => payrollTxns.reduce((sum, txn) => sum + Math.abs(txn.amount || 0), 0),
    [payrollTxns],
  )

  const hasPayroll = payrollTxns.length > 0

  return (
    <div className="col-span-full">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors"
        style={{
          color: hasPayroll ? 'var(--accent-emerald)' : 'var(--text-muted)',
          background: hasPayroll
            ? 'color-mix(in srgb, var(--accent-emerald) 8%, transparent)'
            : 'transparent',
        }}
        title={hasPayroll ? `${payrollTxns.length} payroll transaction(s)` : 'No payroll transactions linked yet'}
      >
        <Briefcase size={12} strokeWidth={1.8} />
        <span>
          {hasPayroll
            ? `${payrollTxns.length} payroll txn${payrollTxns.length !== 1 ? 's' : ''}`
            : 'No payroll txns'}
        </span>
        {hasPayroll && (
          <span className="font-medium ml-1">{formatCurrency(totalPayroll)}</span>
        )}
        {open
          ? <ChevronUp size={12} strokeWidth={2} />
          : <ChevronDown size={12} strokeWidth={2} />}
      </button>

      {/* Drawer content */}
      {open && (
        <div
          className="mt-2 rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border-subtle)' }}
        >
          {hasPayroll ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-subtle, var(--bg-card))', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Date</th>
                  <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Description</th>
                  <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Account</th>
                  <th className="text-right px-3 py-1.5 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payrollTxns.map((txn, i) => (
                  <tr
                    key={txn.id || i}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle, rgba(255,255,255,0.02))',
                    }}
                  >
                    <td className="px-3 py-1.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {txn.date
                        ? new Date(txn.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-3 py-1.5 truncate max-w-[220px]" style={{ color: 'var(--text-primary)' }}>
                      {txn.merchantName || txn.description || '—'}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {txn.accountName || (txn.cardLastFour ? `••••${txn.cardLastFour}` : '—')}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium whitespace-nowrap" style={{ color: 'var(--accent-emerald)' }}>
                      {formatCurrency(Math.abs(txn.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1px solid var(--border-subtle)', background: 'color-mix(in srgb, var(--accent-emerald) 6%, transparent)' }}>
                  <td colSpan={3} className="px-3 py-1.5 font-semibold" style={{ color: 'var(--text-muted)' }}>Total</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold" style={{ color: 'var(--accent-emerald)' }}>
                    {formatCurrency(totalPayroll)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              No payroll transactions linked to this job yet. Tag transactions as payroll in the{' '}
              <a href="/credit-cards" className="underline" style={{ color: 'var(--accent-blue)' }}>
                Transaction Hub
              </a>{' '}
              to see them here.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
