import { useState, useCallback, useRef, useEffect } from 'react'
import { formatDate, formatMonths, formatCurrency } from '../utils/formatters'
import { NOTIFICATION_DEBOUNCE_MS } from '../constants/financial'

function evaluate(burndown, preferences, initialBalance, budgetVariance) {
  if (!preferences.enabled) return []
  if (preferences.mutedUntil && new Date(preferences.mutedUntil) > new Date()) return []

  const { thresholds } = preferences
  const { totalRunwayMonths, runoutDate, benefitEnd } = burndown
  const notifications = []

  if (totalRunwayMonths !== null && totalRunwayMonths !== undefined) {
    if (totalRunwayMonths < thresholds.runwayCritical) {
      notifications.push({
        id: 'notif_runway_critical',
        type: 'runway_critical',
        severity: 'critical',
        title: `Runway Below ${thresholds.runwayCritical} Months`,
        message: `At current burn rate, funds run out on ${formatDate(runoutDate)}.`,
      })
    } else if (totalRunwayMonths < thresholds.runwayWarning) {
      notifications.push({
        id: 'notif_runway_warning',
        type: 'runway_warning',
        severity: 'warning',
        title: `Runway Below ${thresholds.runwayWarning} Months`,
        message: `${formatMonths(totalRunwayMonths)} remaining. Runout: ${formatDate(runoutDate)}.`,
      })
    }
  }

  if (totalRunwayMonths === null || (totalRunwayMonths !== null && totalRunwayMonths >= thresholds.runwaySafe)) {
    notifications.push({
      id: 'notif_runway_safe',
      type: 'runway_safe',
      severity: 'info',
      title: 'Runway Looking Healthy',
      message: totalRunwayMonths === null
        ? 'No runout projected within 10-year window.'
        : `${formatMonths(totalRunwayMonths)} of runway remaining.`,
    })
  }

  if (benefitEnd) {
    const daysUntilEnd = Math.ceil((new Date(benefitEnd) - new Date()) / (1000 * 60 * 60 * 24))
    if (daysUntilEnd > 0 && daysUntilEnd <= thresholds.benefitEndDays) {
      notifications.push({
        id: 'notif_benefit_expiring',
        type: 'benefit_expiring',
        severity: 'warning',
        title: 'Benefits Expiring Soon',
        message: `Unemployment benefits end in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} (${formatDate(benefitEnd)}).`,
      })
    }
  }

  if (initialBalance > 0 && burndown.dataPoints?.length > 0) {
    const currentBalance = burndown.dataPoints[0].rawBalance ?? burndown.dataPoints[0].balance
    const ratio = currentBalance / initialBalance
    for (const milestone of thresholds.balanceMilestones) {
      if (ratio <= milestone) {
        const pct = Math.round(milestone * 100)
        notifications.push({
          id: `notif_balance_${pct}`,
          type: 'balance_milestone',
          severity: milestone <= 0.10 ? 'critical' : 'warning',
          title: `Balance at ${pct}% of Initial`,
          message: `Current balance ${formatCurrency(currentBalance)} is ${pct}% or less of starting ${formatCurrency(initialBalance)}.`,
        })
      }
    }
  }

  // Budget over-limit alerts
  if (Array.isArray(budgetVariance)) {
    for (const v of budgetVariance) {
      if (v.overBudget) {
        notifications.push({
          id: `notif_budget_over_${v.categoryKey}`,
          type: 'budget_over',
          severity: v.pct >= 150 ? 'critical' : 'warning',
          title: `${v.categoryLabel} Over Budget`,
          message: `Spent ${formatCurrency(v.actual)} of ${formatCurrency(v.monthlyLimit)} budget (${Math.round(v.pct)}%).`,
        })
      }
    }
  }

  return notifications
}

export function useNotifications(burndown, preferences, initialBalance, { addToast, onPreferencesChange, budgetVariance } = {}) {
  const dismissedIds = preferences?.dismissedIds || []
  const prevStateRef = useRef(null)
  const debounceRef = useRef(null)
  const [notifications, setNotifications] = useState([])

  const dismiss = useCallback((id) => {
    if (!onPreferencesChange) return
    onPreferencesChange(prev => ({
      ...prev,
      dismissedIds: [...new Set([...(prev.dismissedIds || []), id])],
    }))
  }, [onPreferencesChange])

  const dismissAll = useCallback(() => {
    if (!onPreferencesChange) return
    onPreferencesChange(prev => ({
      ...prev,
      dismissedIds: [...new Set([...(prev.dismissedIds || []), ...notifications.map(n => n.id)])],
    }))
  }, [onPreferencesChange, notifications])

  useEffect(() => {
    if (!burndown || !preferences) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const raw = evaluate(burndown, preferences, initialBalance, budgetVariance)
      const active = raw.map(n => ({
        ...n,
        dismissed: dismissedIds.includes(n.id),
      }))
      setNotifications(active)

      const prevIds = prevStateRef.current
      if (prevIds !== null && addToast) {
        const newCrossings = active.filter(
          n => !n.dismissed && !prevIds.has(n.id) && n.severity !== 'info'
        )
        for (const n of newCrossings) {
          addToast({ title: n.title, message: n.message, severity: n.severity })
        }
      }
      prevStateRef.current = new Set(active.map(n => n.id))
    }, NOTIFICATION_DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [burndown, preferences, initialBalance, dismissedIds, addToast, budgetVariance])

  const visible = notifications.filter(n => !n.dismissed)
  const unreadCount = visible.length
  const highestSeverity = visible.reduce((best, n) => {
    if (n.severity === 'critical') return 'critical'
    if (n.severity === 'warning' && best !== 'critical') return 'warning'
    return best
  }, 'info')

  return {
    notifications: visible,
    allNotifications: notifications,
    unreadCount,
    highestSeverity,
    dismiss,
    dismissAll,
  }
}
