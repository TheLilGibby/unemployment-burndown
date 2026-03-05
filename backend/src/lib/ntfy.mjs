import logger from './logger.mjs'

const NTFY_BASE_URL = process.env.NTFY_BASE_URL || 'https://ntfy.sh'
const NTFY_TOPIC    = process.env.NTFY_TOPIC    || ''
const NTFY_TOKEN    = process.env.NTFY_TOKEN    || ''  // optional access token for private topics
const APP_URL       = process.env.APP_URL        || 'http://localhost:5173'

/**
 * Send a push notification via ntfy.sh.
 *
 * @param {object} opts
 * @param {string} opts.title    - Notification title
 * @param {string} opts.message  - Notification body text
 * @param {string} [opts.priority] - 1=min, 2=low, 3=default, 4=high, 5=urgent
 * @param {string[]} [opts.tags]  - Emoji tags (e.g. ['warning', 'moneybag'])
 * @param {string} [opts.click]   - URL to open when notification is tapped
 * @param {string} [opts.topic]   - Override the default topic
 */
export async function sendPushNotification({ title, message, priority = '3', tags = [], click, topic }) {
  const targetTopic = topic || NTFY_TOPIC
  if (!targetTopic) {
    logger.warn('ntfy: no topic configured — skipping push notification')
    return { sent: false, reason: 'no_topic' }
  }

  const url = `${NTFY_BASE_URL}/${targetTopic}`
  const headers = {
    'Title': title,
    'Priority': String(priority),
    'Content-Type': 'text/plain',
  }

  if (tags.length > 0) {
    headers['Tags'] = tags.join(',')
  }

  if (click) {
    headers['Click'] = click
  }

  if (NTFY_TOKEN) {
    headers['Authorization'] = `Bearer ${NTFY_TOKEN}`
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: message,
    })

    if (!res.ok) {
      const text = await res.text()
      logger.error({ status: res.status, body: text }, 'ntfy: failed to send notification')
      return { sent: false, reason: 'http_error', status: res.status }
    }

    logger.info({ topic: targetTopic, title }, 'ntfy: notification sent')
    return { sent: true }
  } catch (err) {
    logger.error({ err }, 'ntfy: network error sending notification')
    return { sent: false, reason: 'network_error' }
  }
}

/**
 * Map severity to ntfy priority and emoji tags.
 */
export function severityToNtfy(severity) {
  switch (severity) {
    case 'critical':
      return { priority: '5', tags: ['rotating_light'] }
    case 'warning':
      return { priority: '4', tags: ['warning'] }
    default:
      return { priority: '3', tags: ['information_source'] }
  }
}

/**
 * Build a deep-link URL into the app for a notification type.
 */
export function buildClickUrl(notificationType) {
  const routes = {
    runway_critical: '/burndown',
    runway_warning: '/burndown',
    runway_safe: '/burndown',
    benefit_expiring: '/burndown',
    balance_milestone: '/burndown',
    category_spending: '/credit-cards',
  }
  const path = routes[notificationType] || '/'
  return `${APP_URL}${path}`
}
