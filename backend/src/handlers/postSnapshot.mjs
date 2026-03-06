import { readSnapshotIndex, writeSnapshotIndex, writeSnapshot } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * POST /api/snapshots
 * Save a daily snapshot (idempotent: once per calendar day).
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const orgId = user.orgId
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
    const body = JSON.parse(event.body || '{}')

    const index = await readSnapshotIndex(orgId)
    const alreadyExisted = index.dates.includes(today)

    if (!alreadyExisted) {
      const snapshot = {
        capturedAt: new Date().toISOString(),
        date: today,
        state: body,
      }
      await writeSnapshot(orgId, today, snapshot)
      index.dates = [...index.dates, today].sort()
      await writeSnapshotIndex(orgId, index)
    }

    return ok({ saved: true, date: today, alreadyExisted })
  } catch (error) {
    const log = createRequestLogger('postSnapshot', event)
    log.error({ err: error }, 'failed to save snapshot')
    return err(500, error.message)
  }
}
