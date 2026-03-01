import { requireOrg } from '../lib/auth.mjs'
import { getOrg } from '../lib/orgs.mjs'
import { getMembersByOrg } from '../lib/orgMembers.mjs'
import { getUser } from '../lib/users.mjs'
import { ok, err } from '../lib/response.mjs'

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

    // Enrich members with email (without exposing sensitive data)
    const memberList = await Promise.all(members.map(async (m) => {
      const u = await getUser(m.userId)
      return {
        userId: m.userId,
        email: u?.email || m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
      }
    }))

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
    console.error('orgGet error:', error.message)
    return err(500, 'Failed to get organization')
  }
}
