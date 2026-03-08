import { readDataJson, readStatementIndex, readStatement } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'
import { sendPushNotification, severityToNtfy, buildClickUrl } from '../lib/ntfy.mjs'

/**
 * POST /api/alerts/evaluate
 *
 * Evaluates alert rules against the user's current data and sends
 * push notifications via ntfy.sh for any triggered alerts.
 *
 * Body: {
 *   notifications: [{ id, type, severity, title, message }],   // existing burndown alerts from the frontend
 *   categoryAlerts: [{ categoryKey, categoryLabel, monthlyLimit }], // category spending thresholds
 *   ntfyTopic: string,       // user's ntfy topic
 *   ntfyToken: string,       // optional access token for private topics
 *   redactAmounts: boolean,   // if true, strip dollar amounts from push messages
 *   sentAlertIds: string[]   // IDs already sent (to avoid duplicates)
 * }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const {
      notifications = [],
      categoryAlerts = [],
      ntfyTopic,
      ntfyToken = '',
      redactAmounts = true,
      sentAlertIds = [],
    } = body

    if (!ntfyTopic) {
      return err(400, 'ntfyTopic is required')
    }

    const sentSet = new Set(sentAlertIds)
    const results = []

    // ── 1. Send existing burndown alerts (runway, benefits, balance) ──
    for (const notif of notifications) {
      if (sentSet.has(notif.id)) continue
      if (notif.severity === 'info') continue // don't push info-level

      const { priority, tags } = severityToNtfy(notif.severity)
      const click = buildClickUrl(notif.type)
      const message = redactAmounts ? redactDollarAmounts(notif.message) : notif.message

      const res = await sendPushNotification({
        title: notif.title,
        message,
        priority,
        tags,
        click,
        topic: ntfyTopic,
        token: ntfyToken,
      })
      results.push({ id: notif.id, ...res })
    }

    // ── 2. Evaluate category spending thresholds ──
    if (categoryAlerts.length > 0) {
      const spending = await computeMonthlySpending(user.orgId)

      for (const alert of categoryAlerts) {
        const alertId = `category_${alert.categoryKey}_${currentMonth()}`
        if (sentSet.has(alertId)) continue

        const spent = spending[alert.categoryKey] || 0
        if (spent >= alert.monthlyLimit) {
          const { priority, tags } = severityToNtfy('warning')
          const message = redactAmounts
            ? `${alert.categoryLabel} spending has exceeded your monthly limit. Open the app for details.`
            : `${alert.categoryLabel} spending has reached $${spent.toFixed(2)} (limit: $${alert.monthlyLimit.toFixed(2)})`

          const res = await sendPushNotification({
            title: `${alert.categoryLabel} Over Budget`,
            message,
            priority,
            tags: [...tags, 'moneybag'],
            click: buildClickUrl('category_spending'),
            topic: ntfyTopic,
            token: ntfyToken,
          })
          results.push({ id: alertId, categoryKey: alert.categoryKey, spent, limit: alert.monthlyLimit, ...res })
        }
      }
    }

    return ok({ evaluated: true, results })
  } catch (error) {
    const log = createRequestLogger('sendAlerts', event)
    log.error({ err: error }, 'alert evaluation failed')
    return err(500, error.message)
  }
}

/**
 * Compute total spending per category for the current calendar month
 * by reading the statement files from S3.
 */
async function computeMonthlySpending(orgId) {
  const spending = {}
  const month = currentMonth() // e.g. "2026-03"

  try {
    const index = await readStatementIndex(orgId)
    if (!index?.statements?.length) return spending

    // Filter statements that overlap with the current month
    const relevant = index.statements.filter(s => {
      if (!s.month) return false
      return s.month === month || s.month.startsWith(month)
    })

    for (const meta of relevant) {
      const stmt = await readStatement(orgId, meta.id)
      if (!stmt?.transactions) continue

      for (const txn of stmt.transactions) {
        // Only count debits (positive amounts in Plaid = money out)
        const amount = txn.amount ?? 0
        if (amount <= 0) continue

        const cat = txn.categoryOverride || txn.category || 'other'
        spending[cat] = (spending[cat] || 0) + amount
      }
    }
  } catch (e) {
    // Non-fatal: return what we have
  }

  return spending
}

function currentMonth() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Strip dollar amounts from notification text to prevent data leaks
 * in public ntfy topics. Replaces "$1,234.56" with "[amount hidden]".
 */
function redactDollarAmounts(text) {
  return text.replace(/\$[\d,]+(?:\.\d{1,2})?/g, '[amount hidden]')
}
