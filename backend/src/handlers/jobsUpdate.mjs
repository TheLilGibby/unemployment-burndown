import { requireOrg } from '../lib/auth.mjs'
import { getJob, updateJob } from '../lib/jobs.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const jobId = event.pathParameters?.jobId
    if (!jobId) return err(400, 'jobId is required')

    const existing = await getJob(user.orgId, jobId)
    if (!existing) return err(404, 'Job not found')

    const body = JSON.parse(event.body || '{}')
    const updated = await updateJob(user.orgId, jobId, body)

    return ok({ job: updated })
  } catch (error) {
    const log = createRequestLogger('jobsUpdate', event)
    log.error({ err: error }, 'update job failed')
    return err(500, 'Failed to update job')
  }
}
