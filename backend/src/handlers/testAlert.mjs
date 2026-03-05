import { requireAuth } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { sendPushNotification } from '../lib/ntfy.mjs'

/**
 * POST /api/alerts/test
 *
 * Sends a test push notification to verify ntfy.sh is configured correctly.
 * Body: { ntfyTopic: string }
 */
export async function handler(event) {
  try {
    const { error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const { ntfyTopic, ntfyToken } = JSON.parse(event.body || '{}')
    if (!ntfyTopic) return err(400, 'ntfyTopic is required')

    const res = await sendPushNotification({
      title: 'Financial Burndown - Test Alert',
      message: 'Push notifications are working! You will receive alerts when thresholds are crossed.',
      priority: '3',
      tags: ['white_check_mark', 'bell'],
      click: (process.env.APP_URL || 'http://localhost:5173') + '/burndown',
      topic: ntfyTopic,
      token: ntfyToken,
    })

    return ok({ tested: true, ...res })
  } catch (error) {
    return err(500, error.message)
  }
}
