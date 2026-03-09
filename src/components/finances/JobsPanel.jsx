import usePersistedState from '../../hooks/usePersistedState'
import dayjs from 'dayjs'
import { formatCurrency } from '../../utils/formatters'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import CurrencyInput from './CurrencyInput'
import JobPayrollDrawer from './JobPayrollDrawer'
import { ChevronDown, ChevronUp, Trash2, Plus, Briefcase, Calendar, Building2, DollarSign } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'active',     label: 'Active' },
  { value: 'furloughed', label: 'Furloughed' },
  { value: 'laid_off',   label: 'Laid Off' },
  { value: 'quit',       label: 'Quit' },
]

const STATUS_STYLES = {
  active:     { bg: 'color-mix(in srgb, var(--accent-emerald) 20%, var(--bg-input))', border: 'color-mix(in srgb, var(--accent-emerald) 40%, var(--border-input))', color: 'var(--accent-emerald)' },
  furloughed: { bg: 'color-mix(in srgb, var(--accent-amber) 20%, var(--bg-input))',   border: 'color-mix(in srgb, var(--accent-amber) 40%, var(--border-input))',   color: 'var(--accent-amber)' },
  laid_off:   { bg: 'color-mix(in srgb, var(--accent-red) 20%, var(--bg-input))',     border: 'color-mix(in srgb, var(--accent-red) 40%, var(--border-input))',     color: 'var(--accent-red)' },
  quit:       { bg: 'color-mix(in srgb, var(--accent-red) 20%, var(--bg-input))',     border: 'color-mix(in srgb, var(--accent-red) 40%, var(--border-input))',     color: 'var(--accent-red)' },
}

function formatDateRange(startDate, endDate) {
  const fmt = d => d ? dayjs(d).format('MMM YYYY') : null
  const start = fmt(startDate)
  const end = fmt(endDate)
  if (start && end) return `${start} — ${end}`
  if (start) return `${start} — Present`
  return ''
}

export default function JobsPanel({ jobs, onChange, people = [], allTransactions = [], transactionOverrides = {} }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(jobs, onChange)
  const [expandedJobId, setExpandedJobId] = usePersistedState('burndown_expanded_job', null)
  const [payrollOpenJobId, setPayrollOpenJobId] = usePersistedState('burndown_payroll_open_job', null)

  function updateItem(id, field, val) {
    onChange(jobs.map(job => {
      if (job.id !== id) return job
      const updated = { ...job, [field]: val }
      if (field === 'status' && val !== 'active') {
        if (!job.statusDate) updated.statusDate = dayjs().format('YYYY-MM-DD')
        if (!job.endDate) updated.endDate = dayjs().format('YYYY-MM-DD')
      }
      return updated
    }))
  }

  function deleteItem(id) {
    onChange(jobs.filter(job => job.id !== id))
  }

  function addItem() {
    const newId = crypto.randomUUID()
    onChange([
      ...jobs,
      { id: newId, title: '', employer: '', monthlySalary: 0, startDate: '', endDate: '', status: 'active', statusDate: '', assignedTo: null },
    ])
    setExpandedJobId(newId)
  }

  const today = dayjs()
  const activeJobs = jobs.filter(j => {
    if (j.endDate && dayjs(j.endDate).isBefore(today)) return false
    if (!j.endDate && j.status !== 'active') return false
    return true
  })
  const activeIncome = activeJobs.reduce((sum, j) => sum + (Number(j.monthlySalary) || 0), 0)
  const inactiveCount = jobs.length - activeJobs.length

  return (
    <div className="space-y-3">
      {jobs.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <Briefcase className="w-10 h-10 mx-auto" style={{ color: 'var(--text-faint)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No jobs yet. Add current or past employment to track income and payroll.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => {
            const st = STATUS_STYLES[job.status] || STATUS_STYLES.active
            const isExpanded = expandedJobId === job.id
            const statusLabel = STATUS_OPTIONS.find(o => o.value === job.status)?.label || job.status
            const displayTitle = job.title || 'Untitled Position'
            const displayEmployer = job.employer || ''

            return (
              <div
                key={job.id}
                className={`rounded-lg transition-all ${
                  draggingId === job.id ? 'opacity-40' : ''
                } ${
                  overedId === job.id && draggingId !== job.id
                    ? 'ring-2 ring-emerald-500/50 ring-inset'
                    : ''
                }`}
                style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-card, var(--bg-input))' }}
                {...getItemProps(job.id)}
              >
                {/* Card header — always visible */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
                  onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onClick={e => e.stopPropagation()}
                    {...dragHandleProps(job.id)}
                  >
                    <DragHandle />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate" style={{ color: job.title ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {displayTitle}
                      </span>
                      {displayEmployer && (
                        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          at {displayEmployer}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {(job.monthlySalary > 0) && (
                        <span className="font-medium sensitive" style={{ color: 'var(--accent-emerald)' }}>
                          {formatCurrency(job.monthlySalary)}/mo
                        </span>
                      )}
                      {(job.startDate || job.endDate) && (
                        <span>{formatDateRange(job.startDate, job.endDate)}</span>
                      )}
                    </div>
                  </div>

                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                    style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}
                  >
                    {statusLabel}
                  </span>

                  <div className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Card body — expanded */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      {/* Job Title */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                          <Briefcase size={11} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
                          Job Title
                        </label>
                        <input
                          type="text"
                          value={job.title}
                          onChange={e => updateItem(job.id, 'title', e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                          placeholder="e.g. Software Engineer"
                        />
                      </div>

                      {/* Employer */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                          <Building2 size={11} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
                          Employer
                        </label>
                        <input
                          type="text"
                          value={job.employer}
                          onChange={e => updateItem(job.id, 'employer', e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                          placeholder="e.g. Acme Corp"
                        />
                      </div>

                      {/* Monthly Salary */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                          <DollarSign size={11} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
                          Monthly Salary
                        </label>
                        <div
                          className="flex items-center rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-emerald-500"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)' }}
                        >
                          <span className="text-sm mr-1" style={{ color: 'var(--accent-emerald)' }}>$</span>
                          <CurrencyInput
                            value={job.monthlySalary}
                            onChange={val => updateItem(job.id, 'monthlySalary', val)}
                            className="bg-transparent text-sm w-full outline-none"
                            style={{ color: 'var(--text-primary)' }}
                            min="0"
                          />
                        </div>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Status</label>
                        <select
                          value={job.status}
                          onChange={e => updateItem(job.id, 'status', e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none cursor-pointer font-medium"
                          style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Start Date */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                          <Calendar size={11} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={job.startDate}
                          onChange={e => updateItem(job.id, 'startDate', e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* End Date */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                          <Calendar size={11} className="inline mr-1" style={{ verticalAlign: '-1px' }} />
                          End Date
                        </label>
                        <input
                          type="date"
                          value={job.endDate}
                          onChange={e => updateItem(job.id, 'endDate', e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                          placeholder="Blank = ongoing"
                        />
                      </div>

                      {/* Status Date */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                          Status Date
                        </label>
                        <input
                          type="date"
                          value={job.statusDate}
                          onChange={e => updateItem(job.id, 'statusDate', e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)' }}
                          title="Date status changed (e.g. furlough date)"
                        />
                      </div>

                      {/* Assigned To */}
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Assigned To</label>
                        <AssigneeSelect
                          people={people}
                          value={job.assignedTo ?? null}
                          onChange={val => updateItem(job.id, 'assignedTo', val)}
                        />
                      </div>
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2">
                        <JobPayrollDrawer
                          job={job}
                          allTransactions={allTransactions}
                          transactionOverrides={transactionOverrides}
                          open={payrollOpenJobId === job.id}
                          onToggle={() => setPayrollOpenJobId(prev => prev === job.id ? null : job.id)}
                        />
                        <CommentButton itemId={`job_${job.id}`} label={job.title || job.employer || 'Job'} />
                      </div>
                      <button
                        onClick={() => deleteItem(job.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={addItem}
        className="w-full py-2.5 rounded-lg border border-dashed text-sm transition-colors flex items-center justify-center gap-1.5"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent-emerald)'
          e.currentTarget.style.color = 'var(--accent-emerald)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
      >
        <Plus size={14} />
        Add Job
      </button>

      {jobs.length > 0 && (
        <div className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm" style={{ background: 'color-mix(in srgb, var(--accent-emerald) 10%, transparent)' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Active income: </span>
            <span className="font-semibold sensitive" style={{ color: 'var(--accent-emerald)' }}>{formatCurrency(activeIncome)}/mo</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Jobs: </span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {activeJobs.length} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ''}
            </span>
          </div>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Active jobs contribute their salary to the burndown as income. Click a card to expand and edit details. Drag <span style={{ color: 'var(--text-muted)' }}>&#x2807;</span> to reorder.
      </p>
    </div>
  )
}
