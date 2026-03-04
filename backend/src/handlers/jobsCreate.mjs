import { requireOrg } from '../lib/auth.mjs'
import { createJob } from '../lib/jobs.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { title, employer, monthlySalary, startDate, endDate, status, statusDate, assignedTo } = body

    if (!title && !employer) {
      return err(400, 'Job title or employer is required')
    }

    const job = await createJob({
      orgId: user.orgId,
      userId: user.sub,
      title,
      employer,
      monthlySalary,
      startDate,
      endDate,
      status,
      statusDate,
      assignedTo,
    })

    const audit = createAuditLogger('jobsCreate', event)
    audit.info({ userId: user.sub, jobId: job.jobId, title, employer }, 'job created')

    return ok({ job })
  } catch (error) {
    const log = createRequestLogger('jobsCreate', event)
    log.error({ err: error }, 'create job failed')
    return err(500, 'Failed to create job')
  }
}
