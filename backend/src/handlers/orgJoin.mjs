import { requireAuth, signToken } from '../lib/auth.mjs'
import { getUser, updateUserOrg } from '../lib/users.mjs'
import { getOrgByJoinCode } from '../lib/orgs.mjs'
import { addMember, getMember } from '../lib/orgMembers.mjs'
import { readDataJson, writeDataJson } from '../lib/s3.mjs'
import { ok, err } from '../lib/response.mjs'

/**
 * POST /api/org/join
 * Headers: Authorization: Bearer <token>
 * Body: { joinCode }
 *
 * Joins an existing organization using a join code.
 * Adds the user as a person in the org's data.json.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const user = await getUser(tokenUser.sub)
    if (!user) return err(404, 'User not found')

    if (user.orgId) {
      return err(409, 'You already belong to an organization')
    }

    const body = JSON.parse(event.body || '{}')
    const { joinCode } = body

    if (!joinCode || !joinCode.trim()) {
      return err(400, 'Join code is required')
    }

    // Look up org by join code
    const org = await getOrgByJoinCode(joinCode.trim().toUpperCase())
    if (!org) {
      return err(404, 'Invalid join code')
    }

    // Check if already a member
    const existing = await getMember(org.orgId, user.userId)
    if (existing) {
      return err(409, 'You are already a member of this organization')
    }

    // Add as member
    await addMember({ orgId: org.orgId, userId: user.userId, role: 'member' })

    // Update user record
    await updateUserOrg(user.userId, org.orgId, 'member')

    // Add as a person in the org's data.json
    const data = await readDataJson(org.orgId)
    if (data && data.state) {
      const maxId = data.state.people?.reduce((max, p) => Math.max(max, p.id || 0), 0) || 0
      data.state.people = data.state.people || []
      data.state.people.push({
        id: maxId + 1,
        name: user.email.split('@')[0],
        color: '#8b5cf6',
        linkedUserId: user.userId,
        email: user.email,
      })
      data.savedAt = new Date().toISOString()
      await writeDataJson(data, org.orgId)
    }

    // Issue new JWT with org info
    const token = signToken(user.userId, {
      mfaVerified: tokenUser.mfaVerified,
      orgId: org.orgId,
      orgRole: 'member',
    })

    return ok({
      token,
      org: { orgId: org.orgId, name: org.name },
      user: {
        userId: user.userId,
        email: user.email,
        mfaEnabled: user.mfaEnabled,
        orgId: org.orgId,
        orgRole: 'member',
      },
    })
  } catch (error) {
    console.error('orgJoin error:', error.message)
    return err(500, 'Failed to join organization')
  }
}
