import { readStatementIndex, writeStatementIndex, deleteStatement } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * DELETE /api/statements/by-account/{cardId}
 * Removes all statements for a given account from S3 and the index.
 */
export async function handler(event) {
  const log = createRequestLogger('deleteStatementsByAccount', event)
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const cardId = Number(event.pathParameters?.cardId)
    if (!cardId || isNaN(cardId)) return err(400, 'Invalid cardId')

    const index = await readStatementIndex(user.orgId)
    const toRemove = (index.statements || []).filter(s => s.cardId === cardId)
    if (toRemove.length === 0) return ok({ deleted: 0 })

    // Delete individual statement files (best effort)
    for (const stmt of toRemove) {
      try {
        await deleteStatement(user.orgId, stmt.id)
      } catch (e) {
        log.warn({ err: e, stmtId: stmt.id }, 'failed to delete statement file')
      }
    }

    // Update the index
    index.statements = (index.statements || []).filter(s => s.cardId !== cardId)
    index.lastUpdated = new Date().toISOString()
    await writeStatementIndex(user.orgId, index)

    log.info({ cardId, count: toRemove.length }, 'deleted statements for account')
    return ok({ deleted: toRemove.length })
  } catch (error) {
    log.error({ err: error }, 'failed to delete statements by account')
    return err(500, error.message)
  }
}
