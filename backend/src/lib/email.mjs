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

export async function sendInviteEmail(toEmail, inviterEmail, orgName, inviteUrl, joinCode) {
  if (!SENDGRID_API_KEY) {
    logger.info(
      { email: toEmail, inviterEmail, orgName, inviteUrl, joinCode },
      'DEV MODE: Household invite link (not sent via email)',
    )
    return
  }

  await sgMail.send({
    to: toEmail,
    from: FROM_EMAIL,
    subject: `You've been invited to join ${orgName} on Financial Burndown`,
    text: [
      `${inviterEmail} has invited you to join the "${orgName}" household on Financial Burndown.`,
      '',
      `Click here to accept the invite: ${inviteUrl}`,
      '',
      `Your household join code is: ${joinCode}`,
      '',
      'This invite expires in 7 days. You will need to set up two-factor authentication (SMS) during signup.',
    ].join('\n'),
    html: [
      `<p><strong>${inviterEmail}</strong> has invited you to join the <strong>"${orgName}"</strong> household on Financial Burndown.</p>`,
      `<p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Accept Invite</a></p>`,
      `<p style="color:#666;font-size:14px;">Your household join code is: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-weight:bold;">${joinCode}</code></p>`,
      '<p style="color:#999;font-size:12px;">This invite expires in 7 days. You will need to set up two-factor authentication (SMS) during signup.</p>',
    ].join(''),
  })
}
