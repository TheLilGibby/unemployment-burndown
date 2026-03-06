import { readStatement, writeStatement } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * PATCH /api/statements/{statementId}/transactions/{transactionId}
 *
 * Updates specific fields on a transaction within a statement and marks it
 * as user-modified so that future Plaid resyncs preserve the changes.
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

    const stmt = await readStatement(user.orgId, statementId)
    if (!stmt) return err(404, 'Statement not found')

    const txnIndex = stmt.transactions.findIndex(t => t.id === transactionId)
    if (txnIndex === -1) return err(404, 'Transaction not found in statement')

    // Apply updates and mark as user-modified
    const txn = stmt.transactions[txnIndex]
    Object.assign(txn, updates)
    txn.userModified = true
    txn.userModifiedAt = new Date().toISOString()
    txn.userModifiedBy = user.sub
    // Track which fields the user has explicitly set
    txn.userModifiedFields = [
      ...new Set([...(txn.userModifiedFields || []), ...Object.keys(updates)])
    ]

    stmt.transactions[txnIndex] = txn
    await writeStatement(user.orgId, statementId, stmt)

    return ok({ updated: true, transaction: txn })
  } catch (error) {
    const log = createRequestLogger('patchTransaction', event)
    log.error({ err: error }, 'failed to patch transaction')
    return err(500, error.message)
  }
}
