import { readDataJson } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /api/data
 * Reads data.json from S3 scoped to the user's org.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const data = await readDataJson(user.orgId)
    if (!data) {
      return ok(null)
    }
    return ok(data)
  } catch (error) {
    const log = createRequestLogger('getData', event)
    log.error({ err: error }, 'failed to read data')
    return err(500, 'An internal error occurred')
  }
}
