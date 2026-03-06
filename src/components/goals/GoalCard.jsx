import { formatCurrency } from '../../utils/formatters'

const COLOR_MAP = {
  blue:    { bg: '#3b82f6', light: 'rgba(59,130,246,0.15)' },
  emerald: { bg: '#10b981', light: 'rgba(16,185,129,0.15)' },
  amber:   { bg: '#f59e0b', light: 'rgba(245,158,11,0.15)' },
  purple:  { bg: '#8b5cf6', light: 'rgba(139,92,246,0.15)' },
  rose:    { bg: '#f43f5e', light: 'rgba(244,63,94,0.15)' },
  cyan:    { bg: '#06b6d4', light: 'rgba(6,182,212,0.15)' },
}

const ICON_PATHS = {
  home: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  ),
  car: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  ),
  plane: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  ),
  baby: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  ),
  piggy: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  chart: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  ),
  creditcard: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  ),
  shield: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  ),
}

function GoalIcon({ icon, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: c.light }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={c.bg} className="w-5 h-5">
        {ICON_PATHS[icon] || ICON_PATHS.piggy}
      </svg>
    </div>
  )
}

function DataSourceLabel({ dataSource }) {
  if (!dataSource) return null
  const labels = {
    manual: 'Manual tracking',
    savingsAccount: 'Linked savings',
    savingsAccounts: 'Linked savings',
    investmentTotal: 'Investment total',
    debtPayoff: 'Debt payoff',
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
      {labels[dataSource.type] || 'Manual'}
    </span>
  )
}

export default function GoalCard({ goal, progress, onEdit, onDelete, onPin, people = [] }) {
  const c = COLOR_MAP[goal.color] || COLOR_MAP.blue
  const person = people.find(p => p.id === goal.assignedTo)

  const targetDateStr = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <div className="theme-card rounded-xl border overflow-hidden transition-all hover:shadow-lg">
      {/* Color accent bar */}
      <div className="h-1" style={{ background: c.bg }} />

      <div className="p-4 space-y-3">
        {/* Header row: icon + name + actions */}
        <div className="flex items-start gap-3">
          <GoalIcon icon={goal.icon} color={goal.color} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {goal.name || 'Untitled Goal'}
              </h3>
              {goal.pinned && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={c.bg} className="w-3.5 h-3.5 shrink-0">
                  <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" />
                </svg>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <DataSourceLabel dataSource={goal.dataSource} />
              {person && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                  {person.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onPin(goal.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: goal.pinned ? c.bg : 'var(--text-muted)' }}
              title={goal.pinned ? 'Unpin' : 'Pin to top'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" />
              </svg>
            </button>
            <button
              onClick={() => onEdit(goal)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Edit goal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(goal.id)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:text-red-400"
              style={{ color: 'var(--text-muted)' }}
              title="Delete goal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-lg font-bold" style={{ color: c.bg }}>
              {formatCurrency(progress.currentValue)}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              of {formatCurrency(goal.targetAmount)}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress.progressPct}%`, background: c.bg }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs font-semibold" style={{ color: c.bg }}>
              {Math.round(progress.progressPct)}%
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatCurrency(progress.remaining)} remaining
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
          {(Number(goal.monthlyContribution) || 0) > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Contributing </span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(goal.monthlyContribution)}/mo
              </span>
            </div>
          )}
          {targetDateStr && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Target </span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{targetDateStr}</span>
            </div>
          )}
          {progress.monthlyNeeded !== null && progress.remaining > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Need </span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatCurrency(progress.monthlyNeeded)}/mo
              </span>
            </div>
          )}
          {goal.targetDate && progress.remaining > 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{
                background: progress.onTrack ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                color: progress.onTrack ? '#10b981' : '#f43f5e',
              }}
            >
              {progress.onTrack ? 'On Track' : 'Behind'}
            </span>
          )}
          {progress.remaining <= 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
            >
              Goal Reached!
            </span>
          )}
        </div>

        {/* Notes */}
        {goal.notes && (
          <p className="text-xs italic pt-1" style={{ color: 'var(--text-muted)' }}>
            {goal.notes}
          </p>
        )}
      </div>
    </div>
  )
}
