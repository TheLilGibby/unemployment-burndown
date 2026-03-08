import { readSnapshotIndex, writeSnapshotIndex, writeSnapshot, deleteSnapshot } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

const RETENTION_DAYS = parseInt(process.env.SNAPSHOT_RETENTION_DAYS || '90', 10)

/**
 * POST /api/snapshots
 * Save a daily snapshot (idempotent: once per calendar day).
 * After saving, prunes snapshots older than SNAPSHOT_RETENTION_DAYS.
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
    }

    // Prune snapshots older than retention window
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
    const cutoffDate = cutoff.toISOString().slice(0, 10)

    const expired = index.dates.filter(d => d < cutoffDate)
    if (expired.length > 0) {
      await Promise.all(expired.map(d => deleteSnapshot(orgId, d)))
      index.dates = index.dates.filter(d => d >= cutoffDate)
    }

    // Write index once (covers both new snapshot addition and pruning)
    if (!alreadyExisted || expired.length > 0) {
      await writeSnapshotIndex(orgId, index)
    }

    return ok({ saved: true, date: today, alreadyExisted, pruned: expired.length })
  } catch (error) {
    const log = createRequestLogger('postSnapshot', event)
    log.error({ err: error }, 'failed to save snapshot')
    return err(500, 'An internal error occurred')
  }
}
