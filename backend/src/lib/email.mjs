import sgMail from '@sendgrid/mail'
import logger from './logger.mjs'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY)
}

export async function sendPasswordResetEmail(toEmail, resetToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(toEmail)}`

  if (!SENDGRID_API_KEY) {
    logger.info(
      { email: toEmail, resetUrl },
      'DEV MODE: Password reset link (not sent via email)',
    )
    return
  }

  await sgMail.send({
    to: toEmail,
    from: FROM_EMAIL,
    subject: 'Reset your Financial Burndown password',
    text: [
      'You requested a password reset for your Financial Burndown account.',
      '',
      `Click here to reset your password: ${resetUrl}`,
      '',
      'This link expires in 1 hour. If you did not request this, you can safely ignore this email.',
    ].join('\n'),
    html: [
      '<p>You requested a password reset for your Financial Burndown account.</p>',
      `<p><a href="${resetUrl}">Click here to reset your password</a></p>`,
      '<p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>',
    ].join(''),
  })
}
