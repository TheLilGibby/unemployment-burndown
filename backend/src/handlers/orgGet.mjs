import { requireOrg } from '../lib/auth.mjs'
import { getOrg } from '../lib/orgs.mjs'
import { getMembersByOrg } from '../lib/orgMembers.mjs'
import { getUsers } from '../lib/users.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

/**
 * GET /api/org
 * Headers: Authorization: Bearer <token>
 *
 * Returns the current user's organization details and member list.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const org = await getOrg(tokenUser.orgId)
    if (!org) return err(404, 'Organization not found')

    const members = await getMembersByOrg(tokenUser.orgId)

    // Batch-fetch all member user records in one call (up to 100 per batch)
    const userRecords = await getUsers(members.map(m => m.userId))
    const userMap = new Map(userRecords.map(u => [u.userId, u]))

    const memberList = members.map((m) => {
      const u = userMap.get(m.userId)
      return {
        userId: m.userId,
        email: u?.email || m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        profileColor: u?.profileColor || 'blue',
        avatarDataUrl: u?.avatarDataUrl || null,
      }
    })

    const response = {
      orgId: org.orgId,
      name: org.name,
      createdAt: org.createdAt,
      members: memberList,
    }

    // Only show join code to owners
    if (tokenUser.orgRole === 'owner') {
      response.joinCode = org.joinCode
    }

    return ok(response)
  } catch (error) {
    const log = createRequestLogger('orgGet', event)
    log.error({ err: error }, 'failed to get organization')
    return err(500, 'Failed to get organization')
  }
}
