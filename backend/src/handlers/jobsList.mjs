import { requireOrg } from '../lib/auth.mjs'
import { getJobsByOrg } from '../lib/jobs.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const jobs = await getJobsByOrg(user.orgId)
    return ok({ jobs })
  } catch (error) {
    const log = createRequestLogger('jobsList', event)
    log.error({ err: error }, 'list jobs failed')
    return err(500, 'Failed to list jobs')
  }
}
