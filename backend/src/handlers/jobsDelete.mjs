import { requireOrg } from '../lib/auth.mjs'
import { getJob, deleteJob } from '../lib/jobs.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const jobId = event.pathParameters?.jobId
    if (!jobId) return err(400, 'jobId is required')

    const existing = await getJob(user.orgId, jobId)
    if (!existing) return err(404, 'Job not found')

    await deleteJob(user.orgId, jobId)

    const audit = createAuditLogger('jobsDelete', event)
    audit.info({ userId: user.sub, jobId }, 'job deleted')

    return ok({ deleted: true, jobId })
  } catch (error) {
    const log = createRequestLogger('jobsDelete', event)
    log.error({ err: error }, 'delete job failed')
    return err(500, 'Failed to delete job')
  }
}
