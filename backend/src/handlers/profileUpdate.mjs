import { updateUserProfile } from '../lib/users.mjs'
import { requireAuth } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

const ALLOWED_COLORS = ['blue', 'purple', 'emerald', 'amber', 'rose', 'cyan']

/**
 * PUT /api/auth/profile
 * Headers: Authorization: Bearer <token>
 * Body: { profileColor?, avatarDataUrl? }
 *
 * Updates the user's profile color and/or avatar image.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { profileColor, avatarDataUrl } = body

    const updates = {}

    if (profileColor !== undefined) {
      if (!ALLOWED_COLORS.includes(profileColor)) {
        return err(400, `profileColor must be one of: ${ALLOWED_COLORS.join(', ')}`)
      }
      updates.profileColor = profileColor
    }

    if (avatarDataUrl !== undefined) {
      if (avatarDataUrl !== null && typeof avatarDataUrl !== 'string') {
        return err(400, 'avatarDataUrl must be a string or null')
      }
      if (avatarDataUrl && !avatarDataUrl.startsWith('data:image/')) {
        return err(400, 'avatarDataUrl must be a valid image data URL')
      }
      // Limit to ~300KB base64 (roughly 200KB image after compression)
      if (avatarDataUrl && avatarDataUrl.length > 400000) {
        return err(400, 'Avatar image is too large. Please use a smaller image.')
      }
      updates.avatarDataUrl = avatarDataUrl
    }

    if (Object.keys(updates).length === 0) {
      return err(400, 'No valid fields provided to update')
    }

    await updateUserProfile(tokenUser.sub, updates)

    return ok({ success: true, ...updates })
  } catch (error) {
    const log = createRequestLogger('profileUpdate', event)
    log.error({ err: error }, 'profile update failed')
    return err(500, error.message)
  }
}
