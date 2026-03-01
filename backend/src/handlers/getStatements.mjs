import { readStatement } from '../lib/s3.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'

/**
 * GET /api/statements
 * Returns the statements index from S3 scoped to the user's org.
 *
 * GET /api/statements/{statementId}
 * Returns a specific statement from S3 scoped to the user's org.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const statementId = event.pathParameters?.statementId
    const data = await readStatement(user.orgId, statementId)

    if (!data) {
      if (statementId) {
        return err(404, 'Statement not found')
      }
      return ok({ version: 1, lastUpdated: null, statements: [] })
    }

    return ok(data)
  } catch (error) {
    console.error('getStatements error:', error.message)
    return err(500, error.message)
  }
}
