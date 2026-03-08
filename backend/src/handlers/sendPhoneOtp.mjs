import { requireAuth } from '../lib/auth.mjs'
import { getUser, setPhoneOtp } from '../lib/users.mjs'
import { generateOtp, hashOtp, sendSmsOtp } from '../lib/sms.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger, createAuditLogger } from '../lib/logger.mjs'

const OTP_EXPIRY_MS = 10 * 60 * 1000 // 10 minutes
const E164_REGEX = /^\+[1-9]\d{6,14}$/

/**
 * POST /api/auth/send-phone-otp
 * Headers: Authorization: Bearer <token>
 * Body: { phoneNumber }
 *
 * Sends an SMS OTP to the given phone number.
 */
export async function handler(event) {
  try {
    const { user: tokenUser, error: authErr } = requireAuth(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    const body = JSON.parse(event.body || '{}')
    const { phoneNumber } = body

    if (!phoneNumber) {
      return err(400, 'Phone number is required')
    }

    if (!E164_REGEX.test(phoneNumber)) {
      return err(400, 'Phone number must be in E.164 format (e.g. +15551234567)')
    }

    const user = await getUser(tokenUser.sub)
    if (!user) return err(404, 'User not found')

    // Rate limiting: check if OTP was sent recently
    if (user.phoneOtpExpiry && new Date(user.phoneOtpExpiry) > new Date()) {
      const timeSinceOtp = Date.now() - (new Date(user.phoneOtpExpiry).getTime() - OTP_EXPIRY_MS)
      if (timeSinceOtp < 60 * 1000) { // at least 60s between sends
        return err(429, 'Please wait before requesting another code')
      }
    }

    // Generate and store OTP
    const otp = generateOtp()
    const otpHash = hashOtp(otp)
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MS).toISOString()

    // Store phone as pending — only promoted to phoneNumber after OTP verification
    await setPhoneOtp(tokenUser.sub, otpHash, otpExpiry, phoneNumber)

    // Send SMS
    await sendSmsOtp(phoneNumber, otp)

    const audit = createAuditLogger('sendPhoneOtp', event)
    audit.info({ userId: tokenUser.sub }, 'phone OTP sent')

    return ok({ message: 'Verification code sent', expiresAt: otpExpiry })
  } catch (error) {
    const log = createRequestLogger('sendPhoneOtp', event)
    log.error({ err: error }, 'send phone OTP failed')
    return err(500, 'Failed to send verification code')
  }
}
