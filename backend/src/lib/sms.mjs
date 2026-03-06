import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import crypto from 'node:crypto'
import { createRequestLogger } from './logger.mjs'

const snsClient = new SNSClient({})

/**
 * Generate a 6-digit OTP code.
 */
export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * Hash an OTP code for secure storage.
 */
export function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Send an SMS OTP to the given phone number via AWS SNS.
 * Phone number must be in E.164 format (e.g. +15551234567).
 */
export async function sendSmsOtp(phoneNumber, otpCode) {
  const log = createRequestLogger('sms', {})

  if (!process.env.SMS_ENABLED || process.env.SMS_ENABLED !== 'true') {
    log.info({ phoneNumber, otpCode }, 'DEV MODE: SMS OTP (not sent)')
    return
  }

  await snsClient.send(new PublishCommand({
    PhoneNumber: phoneNumber,
    Message: `Your verification code is: ${otpCode}. It expires in 10 minutes.`,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional',
      },
    },
  }))

  log.info({ phoneNumber: phoneNumber.slice(0, -4) + '****' }, 'SMS OTP sent')
}
