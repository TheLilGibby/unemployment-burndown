import dayjs from 'dayjs'
import { formatCurrency } from '../../utils/formatters'
import { useDragReorder } from '../../hooks/useDragReorder'
import DragHandle from '../layout/DragHandle'
import AssigneeSelect from '../people/AssigneeSelect'
import CommentButton from '../comments/CommentButton'
import CurrencyInput from './CurrencyInput'

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

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

export default function JobsPanel({ jobs, onChange, people = [] }) {
  const { dragHandleProps, getItemProps, draggingId, overedId } = useDragReorder(jobs, onChange)

  function updateItem(id, field, val) {
    onChange(jobs.map(job => {
      if (job.id !== id) return job
      const updated = { ...job, [field]: val }
      // Auto-populate statusDate when status changes away from active
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
    onChange([
      ...jobs,
      { id: Date.now(), title: '', employer: '', monthlySalary: 0, startDate: '', endDate: '', status: 'active', statusDate: '', assignedTo: null },
    ])
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
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
          No jobs yet. Add current or past employment, job offers, or expected positions.
        </p>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div
            className="hidden sm:grid items-center gap-2 text-xs uppercase tracking-wider font-semibold px-1"
            style={{ gridTemplateColumns: '20px 1fr 0.7fr 110px 110px 110px 100px 110px 32px 32px 32px', color: 'var(--text-muted)' }}
          >
            <span></span>
            <span>Job Title</span>
            <span>Employer</span>
            <span>Salary/Mo</span>
            <span>Start</span>
            <span>End</span>
            <span>Status</span>
            <span>Status Date</span>
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="space-y-2">
            {jobs.map(job => {
              const st = STATUS_STYLES[job.status] || STATUS_STYLES.active
              return (
                <div
                  key={job.id}
                  className={`flex flex-col gap-2 sm:grid sm:items-center rounded-lg transition-all ${
                    draggingId === job.id ? 'opacity-40' : ''
                  } ${
                    overedId === job.id && draggingId !== job.id
                      ? 'ring-2 ring-emerald-500/50 ring-inset'
                      : ''
                  }`}
                  style={{ gridTemplateColumns: '20px 1fr 0.7fr 110px 110px 110px 100px 110px 32px 32px 32px' }}
                  {...getItemProps(job.id)}
                >
                  {/* Row 1 (mobile): drag + title + employer */}
                  <div className="flex items-center gap-2 sm:contents">
                    <div
                      className="flex items-center justify-center select-none flex-shrink-0 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      {...dragHandleProps(job.id)}
                    >
                      <DragHandle />
                    </div>
                    <input
                      type="text"
                      value={job.title}
                      onChange={e => updateItem(job.id, 'title', e.target.value)}
                      className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="Job title"
                    />
                    <input
                      type="text"
                      value={job.employer}
                      onChange={e => updateItem(job.id, 'employer', e.target.value)}
                      className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                      placeholder="Employer"
                    />
                  </div>

                  {/* Row 2 (mobile): salary · dates · status · controls */}
                  <div className="flex items-center gap-2 sm:contents">
                    <div
                      className="flex-1 sm:flex-none flex items-center rounded-lg px-2 py-2 focus-within:ring-1 focus-within:ring-emerald-500"
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
                    <input
                      type="date"
                      value={job.startDate}
                      onChange={e => updateItem(job.id, 'startDate', e.target.value)}
                      className="flex-shrink-0 rounded-lg px-2 py-2 text-sm focus:outline-none w-full sm:w-auto"
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                      title="Employment start date"
                    />
                    <input
                      type="date"
                      value={job.endDate}
                      onChange={e => updateItem(job.id, 'endDate', e.target.value)}
                      className="flex-shrink-0 rounded-lg px-2 py-2 text-sm focus:outline-none w-full sm:w-auto"
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                      title="Employment end date (blank = ongoing)"
                    />
                    <select
                      value={job.status}
                      onChange={e => updateItem(job.id, 'status', e.target.value)}
                      className="flex-shrink-0 rounded-lg px-2 py-2 text-sm focus:outline-none cursor-pointer font-medium"
                      style={{
                        background: st.bg,
                        border: `1px solid ${st.border}`,
                        color: st.color,
                      }}
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={job.statusDate}
                      onChange={e => updateItem(job.id, 'statusDate', e.target.value)}
                      className="flex-shrink-0 rounded-lg px-2 py-2 text-sm focus:outline-none w-full sm:w-auto"
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: 'var(--text-primary)',
                      }}
                      title="Date status changed (e.g. furlough date)"
                    />
                    <AssigneeSelect
                      people={people}
                      value={job.assignedTo ?? null}
                      onChange={val => updateItem(job.id, 'assignedTo', val)}
                    />
                    <CommentButton itemId={`job_${job.id}`} label={job.title || job.employer || 'Job'} />
                    <button
                      onClick={() => deleteItem(job.id)}
                      className="flex items-center justify-center transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <button
        onClick={addItem}
        className="w-full py-2 rounded-lg border border-dashed text-sm transition-colors"
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
        + Add Job
      </button>

      {jobs.length > 0 && (
        <div className="rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm" style={{ background: 'color-mix(in srgb, var(--accent-emerald) 10%, transparent)' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Active income: </span>
            <span className="font-semibold" style={{ color: 'var(--accent-emerald)' }}>{formatCurrency(activeIncome)}/mo</span>
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
        Active jobs contribute their salary to the burndown as income. Status date is used to auto-derive the simulation start date. Drag <span style={{ color: 'var(--text-muted)' }}>&#x2807;</span> to reorder.
      </p>
    </div>
  )
}
