import { useState, useMemo } from 'react'
import { formatCurrency } from '../utils/formatters'
import { computeGoalProgress } from '../utils/goalProgress'
import GoalCard from '../components/goals/GoalCard'
import GoalFormModal from '../components/goals/GoalFormModal'
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal'

const SUGGESTIONS = [
  { icon: 'home',       name: 'Home Down Payment',    category: 'savings' },
  { icon: 'car',        name: 'New Car Fund',          category: 'savings' },
  { icon: 'plane',      name: 'Dream Vacation',        category: 'savings' },
  { icon: 'baby',       name: 'College Fund',           category: 'savings' },
  { icon: 'shield',     name: 'Emergency Fund',         category: 'savings' },
  { icon: 'chart',      name: 'Investment Target',      category: 'investment' },
  { icon: 'creditcard', name: 'Pay Off Credit Cards',   category: 'debt-payoff' },
  { icon: 'piggy',      name: 'Rainy Day Savings',      category: 'savings' },
]

export default function GoalsPage({ goals, onGoalsChange, savingsAccounts = [], investments = [], creditCards = [], people = [] }) {
  const [editingGoal, setEditingGoal] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  const appState = { savingsAccounts, investments, creditCards }

  // Compute progress for all goals
  const goalsWithProgress = useMemo(() =>
    goals.map(g => ({
      goal: g,
      progress: computeGoalProgress(g, appState),
    })),
    [goals, savingsAccounts, investments, creditCards],
  )

  // Sort: pinned first, then by creation date (newest first)
  const sorted = useMemo(() =>
    [...goalsWithProgress].sort((a, b) => {
      if (a.goal.pinned && !b.goal.pinned) return -1
      if (!a.goal.pinned && b.goal.pinned) return 1
      return (b.goal.id || 0) - (a.goal.id || 0)
    }),
    [goalsWithProgress],
  )

  // Summary stats
  const totalTarget = goals.reduce((s, g) => s + (Number(g.targetAmount) || 0), 0)
  const totalCurrent = goalsWithProgress.reduce((s, gp) => s + gp.progress.currentValue, 0)
  const onTrackCount = goalsWithProgress.filter(gp => gp.progress.onTrack || gp.progress.remaining <= 0).length
  const overallPct = totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0

  function handleSave(goalData) {
    const existing = goals.find(g => g.id === goalData.id)
    if (existing) {
      onGoalsChange(goals.map(g => g.id === goalData.id ? goalData : g))
    } else {
      onGoalsChange([...goals, { ...goalData, id: Date.now(), createdAt: new Date().toISOString() }])
    }
    setShowForm(false)
    setEditingGoal(null)
  }

  function handleDelete(id) {
    setPendingDeleteId(id)
  }

  function confirmDelete() {
    onGoalsChange(goals.filter(g => g.id !== pendingDeleteId))
    setPendingDeleteId(null)
  }

  function handlePin(id) {
    onGoalsChange(goals.map(g => g.id === id ? { ...g, pinned: !g.pinned } : g))
  }

  function handleEdit(goal) {
    setEditingGoal(goal)
    setShowForm(true)
  }

  function handleSuggestion(suggestion) {
    setEditingGoal({
      name: suggestion.name,
      icon: suggestion.icon,
      category: suggestion.category,
      color: 'emerald',
    })
    setShowForm(true)
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 main-bottom-pad space-y-5">
      {/* Hero banner */}
      <div className="theme-card rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#10b981' }} />
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Financial Goals
            </h2>
          </div>
          <button
            onClick={() => { setEditingGoal(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: '#10b981' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add Goal
          </button>
        </div>

        {goals.length > 0 ? (
          <>
            <p className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {onTrackCount === goals.length ? 'All Goals On Track' : `${onTrackCount} of ${goals.length} On Track`}
            </p>
            <p className="text-sm mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>
              Set targets, link your accounts, and watch your progress grow.
            </p>

            {/* Overall progress bar */}
            <div className="mb-5">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-medium" style={{ color: '#10b981' }}>
                  Overall: {Math.round(overallPct)}%
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatCurrency(totalCurrent)} of {formatCurrency(totalTarget)}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${overallPct}%`, background: '#10b981' }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 sm:gap-10 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Goals</p>
                <p className="text-xl font-semibold" style={{ color: '#10b981' }}>
                  {goals.length}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Total Target</p>
                <p className="text-xl font-semibold" style={{ color: 'var(--accent-amber)' }}>
                  {formatCurrency(totalTarget)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Current Progress</p>
                <p className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(totalCurrent)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: 'var(--text-muted)' }}>On Track</p>
                <p className="text-xl font-semibold" style={{ color: onTrackCount === goals.length ? '#10b981' : 'var(--accent-red)' }}>
                  {onTrackCount}/{goals.length}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-2xl sm:text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              Set Your First Goal
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Define financial targets and track your progress. Link savings accounts, investments, or credit cards to automatically update your goals.
            </p>
          </>
        )}
      </div>

      {/* Goal cards grid */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sorted.map(({ goal, progress }) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              progress={progress}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPin={handlePin}
              people={people}
            />
          ))}
        </div>
      )}

      {/* Empty state with suggestions */}
      {goals.length === 0 && (
        <div className="theme-card rounded-xl border p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            Quick Start — Popular Goals
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Click a suggestion to get started, or create a fully custom goal.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s.name}
                onClick={() => handleSuggestion(s)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all hover:shadow-md"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-input)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#10b981" className="w-6 h-6">
                  {SUGGESTION_ICONS[s.icon]}
                </svg>
                <span className="text-[11px] text-center leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {s.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add goal CTA at bottom (when goals exist) */}
      {goals.length > 0 && (
        <button
          onClick={() => { setEditingGoal(null); setShowForm(true) }}
          className="w-full py-3 rounded-xl border border-dashed text-sm transition-colors hover:border-emerald-500 hover:text-emerald-400"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          + Add Another Goal
        </button>
      )}

      {/* Form modal */}
      {showForm && (
        <GoalFormModal
          goal={editingGoal}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingGoal(null) }}
          savingsAccounts={savingsAccounts}
          investments={investments}
          creditCards={creditCards}
          people={people}
        />
      )}

      {pendingDeleteId != null && (
        <ConfirmDeleteModal
          itemName={goals.find(g => g.id === pendingDeleteId)?.name || 'this goal'}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </main>
  )
}

// Inline icon paths for suggestions (matches GoalCard icons)
const SUGGESTION_ICONS = {
  home: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />,
  car: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />,
  plane: <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />,
  baby: <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />,
  piggy: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  chart: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />,
  creditcard: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />,
  shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />,
}
