import { readStatementWithETag, writeStatementIfMatch } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

const MAX_RETRIES = 3

/**
 * PATCH /api/statements/{statementId}/transactions/{transactionId}
 *
 * Updates specific fields on a transaction within a statement and marks it
 * as user-modified so that future Plaid resyncs preserve the changes.
 *
 * Uses S3 conditional writes (If-Match ETag) to prevent read-modify-write
 * race conditions when concurrent requests target the same statement.
 *
 * Body: { category?, isPayroll?, payrollJobId? }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const { statementId, transactionId } = event.pathParameters || {}
    if (!statementId || !transactionId) {
      return err(400, 'statementId and transactionId are required')
    }

    const body = JSON.parse(event.body || '{}')
    const allowedFields = ['category', 'isPayroll', 'payrollJobId']
    const updates = {}
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return err(400, 'No valid fields to update')
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { data: stmt, etag } = await readStatementWithETag(user.orgId, statementId)
      if (!stmt) return err(404, 'Statement not found')

      const txnIndex = stmt.transactions.findIndex(t => t.id === transactionId)
      if (txnIndex === -1) return err(404, 'Transaction not found in statement')

      // Apply updates and mark as user-modified
      const txn = stmt.transactions[txnIndex]
      Object.assign(txn, updates)
      txn.userModified = true
      txn.userModifiedAt = new Date().toISOString()
      txn.userModifiedBy = user.sub
      txn.userModifiedFields = [
        ...new Set([...(txn.userModifiedFields || []), ...Object.keys(updates)])
      ]

      stmt.transactions[txnIndex] = txn

      try {
        await writeStatementIfMatch(user.orgId, statementId, stmt, etag)
        return ok({ updated: true, transaction: txn })
      } catch (writeErr) {
        const isPreconditionFailed =
          writeErr.name === 'PreconditionFailed' ||
          writeErr.$metadata?.httpStatusCode === 412
        if (!isPreconditionFailed || attempt === MAX_RETRIES) {
          throw writeErr
        }
        // ETag mismatch — re-read and retry
      }
    }
  } catch (error) {
    const log = createRequestLogger('patchTransaction', event)
    log.error({ err: error }, 'failed to patch transaction')
    return err(500, error.message)
  }
}
