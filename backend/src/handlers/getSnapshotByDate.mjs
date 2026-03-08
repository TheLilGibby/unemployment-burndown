import { readSnapshot } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /api/snapshots/{date}
 * Returns the snapshot for a specific YYYY-MM-DD date.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const date = event.pathParameters?.date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return err(400, 'Invalid date format, expected YYYY-MM-DD')
    }

    const snapshot = await readSnapshot(user.orgId, date)
    if (!snapshot) {
      return err(404, 'Snapshot not found for this date')
    }
    return ok(snapshot)
  } catch (error) {
    const log = createRequestLogger('getSnapshotByDate', event)
    log.error({ err: error }, 'failed to read snapshot')
    return err(500, 'An internal error occurred')
  }
}
