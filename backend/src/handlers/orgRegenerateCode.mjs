import { requireOrg } from '../lib/auth.mjs'
import { regenerateJoinCode } from '../lib/orgs.mjs'
import { ok, err } from '../lib/response.mjs'

/**
 * POST /api/org/regenerate-code
 * Headers: Authorization: Bearer <token>
 *
 * Regenerates the join code for the org. Owner only.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (tokenUser.orgRole !== 'owner') {
      return err(403, 'Only the organization owner can regenerate the join code')
    }

    const newCode = await regenerateJoinCode(tokenUser.orgId)

    return ok({ joinCode: newCode })
  } catch (error) {
    console.error('orgRegenerateCode error:', error.message)
    return err(500, 'Failed to regenerate join code')
  }
}
