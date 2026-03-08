import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stub sgMail before importing email module
vi.mock('@sendgrid/mail', () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([]) },
}))

// Set env vars before import
process.env.SENDGRID_API_KEY = 'test-key'
process.env.APP_URL = 'https://app.example.com'

const { escapeHtml, sendInviteEmail, sendPasswordResetEmail } = await import(
  './email.mjs'
)
const sgMail = (await import('@sendgrid/mail')).default

describe('escapeHtml()', () => {
  it('escapes & < > " and single quotes', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('handles combined XSS payload', () => {
    const payload = '<img src=x onerror="alert(1)">'
    expect(escapeHtml(payload)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    )
  })

  it('returns empty string for non-string input', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(123)).toBe('')
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
    expect(escapeHtml('user@example.com')).toBe('user@example.com')
  })
})

describe('sendInviteEmail()', () => {
  beforeEach(() => {
    sgMail.send.mockClear()
  })

  it('escapes inviterEmail in HTML', async () => {
    await sendInviteEmail(
      'to@test.com',
      '<script>alert(1)</script>',
      'Safe Org',
      'https://app.example.com/invite/abc',
    )
    const call = sgMail.send.mock.calls[0][0]
    expect(call.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(call.html).not.toContain('<script>')
  })

  it('escapes orgName in HTML', async () => {
    await sendInviteEmail(
      'to@test.com',
      'from@test.com',
      '"><img src=x onerror=alert(1)>',
      'https://app.example.com/invite/abc',
    )
    const call = sgMail.send.mock.calls[0][0]
    expect(call.html).toContain('&quot;&gt;&lt;img')
    expect(call.html).not.toContain('<img')
  })

  it('escapes orgName in subject', async () => {
    await sendInviteEmail(
      'to@test.com',
      'from@test.com',
      '<script>',
      'https://app.example.com/invite/abc',
    )
    const call = sgMail.send.mock.calls[0][0]
    expect(call.subject).toContain('&lt;script&gt;')
    expect(call.subject).not.toContain('<script>')
  })

  it('does not escape plaintext body', async () => {
    await sendInviteEmail(
      'to@test.com',
      '<b>user</b>@test.com',
      'Org<Name>',
      'https://app.example.com/invite/abc',
    )
    const call = sgMail.send.mock.calls[0][0]
    // Plaintext should keep raw values (no HTML rendering risk)
    expect(call.text).toContain('<b>user</b>@test.com')
    expect(call.text).toContain('Org<Name>')
  })
})

describe('sendPasswordResetEmail()', () => {
  beforeEach(() => {
    sgMail.send.mockClear()
  })

  it('does not include email in the reset URL', async () => {
    await sendPasswordResetEmail('user@test.com', 'abc123')
    const call = sgMail.send.mock.calls[0][0]
    expect(call.html).not.toContain('email=')
    expect(call.text).not.toContain('email=')
  })

  it('includes only the token in the reset URL', async () => {
    await sendPasswordResetEmail('user@test.com', 'abc123')
    const call = sgMail.send.mock.calls[0][0]
    expect(call.html).toContain('token=abc123')
  })

  it('HTML-escapes the reset URL in href', async () => {
    await sendPasswordResetEmail('user@test.com', 'tok&en')
    const call = sgMail.send.mock.calls[0][0]
    expect(call.html).toContain('tok&amp;en')
  })
})
