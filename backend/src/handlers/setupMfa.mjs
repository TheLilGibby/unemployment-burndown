import { authenticator } from 'otplib'
import QRCode from 'qrcode'
import { getUser, setPendingMfaSecret, enableMfa } from '../lib/users.mjs'
import { requireAuth } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

const APP_NAME = 'BurndownTracker'

/**
 * POST /api/auth/setup-mfa
 * Headers: Authorization: Bearer <token>
 *
 * Generates a TOTP secret and returns a QR code data URL.
 * Does NOT enable MFA yet — user must verify with /enable-mfa.
 */
export async function setupHandler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const user = await getUser(tokenUser.sub)
    if (!user) return err(404, 'User not found')

    // Generate a new TOTP secret
    const secret = authenticator.generateSecret()
    const otpauth = authenticator.keyuri(user.email, APP_NAME, secret)

    // Persist secret server-side so enableHandler reads it from DB, not client
    await setPendingMfaSecret(tokenUser.sub, secret)

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(otpauth)

    return ok({
      secret,
      qrCode: qrDataUrl,
      otpauth,
    })
  } catch (error) {
    const log = createRequestLogger('setupMfa', event)
    log.error({ err: error }, 'MFA setup failed')
    return err(500, 'MFA setup failed')
  }
}

/**
 * POST /api/auth/enable-mfa
 * Headers: Authorization: Bearer <token>
 * Body: { code }
 *
 * Reads the pending TOTP secret from the database (set during setup),
 * verifies the code, then enables MFA.
 */
export async function enableHandler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { code } = body

    if (!code) {
      return err(400, 'Code is required')
    }

    // Read the pending secret from the database — never trust client-supplied secrets
    const user = await getUser(tokenUser.sub)
    if (!user) return err(404, 'User not found')

    const { pendingMfaSecret, pendingMfaExpiry } = user
    if (!pendingMfaSecret) {
      return err(400, 'No pending MFA setup. Please call setup-mfa first.')
    }

    if (Date.now() > pendingMfaExpiry) {
      return err(400, 'MFA setup has expired. Please call setup-mfa again.')
    }

    // Verify the code against the server-stored secret
    const isValid = authenticator.verify({ token: code, secret: pendingMfaSecret })
    if (!isValid) {
      return err(400, 'Invalid code. Please try again.')
    }

    // Enable MFA for the user
    await enableMfa(tokenUser.sub, pendingMfaSecret)

    const audit = createAuditLogger('enableMfa', event)
    audit.info({ userId: tokenUser.sub }, 'MFA enabled for user')

    return ok({ mfaEnabled: true })
  } catch (error) {
    const log = createRequestLogger('enableMfa', event)
    log.error({ err: error }, 'failed to enable MFA')
    return err(500, 'Failed to enable MFA')
  }
}
