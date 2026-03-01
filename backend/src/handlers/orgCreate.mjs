import { requireAuth, signToken } from '../lib/auth.mjs'
import { getUser, updateUserOrg } from '../lib/users.mjs'
import { createOrg } from '../lib/orgs.mjs'
import { addMember } from '../lib/orgMembers.mjs'
import { writeDataJson } from '../lib/s3.mjs'
import { ok, err } from '../lib/response.mjs'

/**
 * POST /api/org/create
 * Headers: Authorization: Bearer <token>
 * Body: { name }
 *
 * Creates a new organization, makes the current user its owner,
 * initializes an empty data.json scoped to the org, and returns
 * a new JWT with orgId/orgRole.
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
    const { name } = body

    if (!name || !name.trim()) {
      return err(400, 'Organization name is required')
    }

    // Create the org
    const { orgId, joinCode } = await createOrg({ name: name.trim(), ownerId: user.userId })

    // Add user as owner member
    await addMember({ orgId, userId: user.userId, role: 'owner' })

    // Update user record with org info
    await updateUserOrg(user.userId, orgId, 'owner')

    // Initialize empty data.json for this org with the user as a person
    const initialData = {
      state: {
        people: [
          { id: 1, name: user.email.split('@')[0], color: '#3b82f6', linkedUserId: user.userId, email: user.email },
        ],
        monthlyIncome: 0,
        savingsAccounts: [],
        creditCards: [],
        bills: [],
        expenses: [],
      },
      savedAt: new Date().toISOString(),
    }
    await writeDataJson(initialData, orgId)

    // Issue new JWT with org info
    const token = signToken(user.userId, {
      mfaVerified: tokenUser.mfaVerified,
      orgId,
      orgRole: 'owner',
    })

    return ok({
      token,
      org: { orgId, name: name.trim(), joinCode },
      user: {
        userId: user.userId,
        email: user.email,
        mfaEnabled: user.mfaEnabled,
        orgId,
        orgRole: 'owner',
      },
    })
  } catch (error) {
    console.error('orgCreate error:', error.message)
    return err(500, 'Failed to create organization')
  }
}
