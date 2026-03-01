import { writeDataJson } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * PUT /api/data
 * Writes data.json to S3 scoped to the user's org.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const data = JSON.parse(event.body || '{}')
    if (!data || Object.keys(data).length === 0) {
      return err(400, 'Request body is empty')
    }
    await writeDataJson(data, user.orgId)
    return ok({ saved: true, savedAt: new Date().toISOString() })
  } catch (error) {
    const log = createRequestLogger('putData', event)
    log.error({ err: error }, 'failed to write data')
    return err(500, error.message)
  }
}
