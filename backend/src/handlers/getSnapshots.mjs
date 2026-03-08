import { readSnapshotIndex } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /api/snapshots
 * Returns the snapshot index (list of available dates).
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const index = await readSnapshotIndex(user.orgId)
    return ok(index)
  } catch (error) {
    const log = createRequestLogger('getSnapshots', event)
    log.error({ err: error }, 'failed to read snapshot index')
    return err(500, 'An internal error occurred')
  }
}
