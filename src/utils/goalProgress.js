/**
 * Compute progress for a single goal based on its data source and app state.
 *
 * @param {object} goal
 * @param {object} appState - { savingsAccounts, investments, creditCards }
 * @returns {{ currentValue, progressPct, remaining, monthlyNeeded, projectedDate, onTrack }}
 */
export function computeGoalProgress(goal, { savingsAccounts = [], investments = [], creditCards = [] }) {
  const target = Number(goal.targetAmount) || 0

  // --- Resolve current value from data source ---
  let currentValue = 0
  const ds = goal.dataSource || { type: 'manual' }

  switch (ds.type) {
    case 'savingsAccount':
    case 'savingsAccounts': {
      const ids = new Set(ds.accountIds || [])
      currentValue = savingsAccounts
        .filter(a => ids.has(a.id) && a.active !== false)
        .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
      break
    }

    case 'investmentTotal': {
      // Sum active monthly investment amounts as a simple proxy
      currentValue = investments
        .filter(i => i.active)
        .reduce((sum, i) => sum + (Number(i.monthlyAmount) || 0), 0)
      break
    }

    case 'debtPayoff': {
      // For debt payoff goals: target = total debt to eliminate
      // progress = target - remaining balance on tracked cards
      const ids = new Set(ds.accountIds || [])
      const remainingDebt = creditCards
        .filter(c => ids.has(c.id))
        .reduce((sum, c) => sum + (Number(c.balance) || 0), 0)
      currentValue = Math.max(0, target - remainingDebt)
      break
    }

    case 'manual':
    default:
      currentValue = Number(goal.currentAmount) || 0
      break
  }

  // --- Derived metrics ---
  const remaining = Math.max(0, target - currentValue)
  const progressPct = target > 0 ? Math.min(100, Math.max(0, (currentValue / target) * 100)) : 0

  // Monthly needed to hit target date
  let monthlyNeeded = null
  if (goal.targetDate && remaining > 0) {
    const now = new Date()
    const end = new Date(goal.targetDate)
    const monthsLeft = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
    if (monthsLeft > 0) {
      monthlyNeeded = remaining / monthsLeft
    } else {
      monthlyNeeded = remaining // past due — need it all now
    }
  }

  // Projected date at current monthly contribution rate
  let projectedDate = null
  const monthly = Number(goal.monthlyContribution) || 0
  if (monthly > 0 && remaining > 0) {
    const monthsToGo = Math.ceil(remaining / monthly)
    const d = new Date()
    d.setMonth(d.getMonth() + monthsToGo)
    projectedDate = d.toISOString().slice(0, 10)
  } else if (remaining <= 0) {
    projectedDate = new Date().toISOString().slice(0, 10) // already done
  }

  // On track?
  let onTrack = remaining <= 0
  if (!onTrack && monthlyNeeded !== null && monthly > 0) {
    onTrack = monthly >= monthlyNeeded * 0.95 // 5% tolerance
  }

  return { currentValue, progressPct, remaining, monthlyNeeded, projectedDate, onTrack }
}
