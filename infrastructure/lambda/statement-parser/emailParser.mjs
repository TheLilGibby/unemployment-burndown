import pino from 'pino'
import { simpleParser } from 'mailparser'
import pdf from 'pdf-parse/lib/pdf-parse.js'

const log = pino({ name: 'statement-parser' })

/**
 * Parse a raw MIME email buffer into a structured object.
 */
export async function parseEmail(buffer) {
  return simpleParser(buffer)
}

/**
 * Extract readable text from an email — combines the body text
 * with text extracted from any PDF attachments.
 */
export async function extractTextFromAttachments(parsed) {
  const parts = []

  // 1. Plain text body
  if (parsed.text) {
    parts.push(parsed.text)
  } else if (parsed.html) {
    // Strip HTML tags for a rough plain-text fallback
    parts.push(parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  }

  // 2. PDF attachments
  if (parsed.attachments?.length) {
    for (const att of parsed.attachments) {
      if (
        att.contentType === 'application/pdf' ||
        att.filename?.toLowerCase().endsWith('.pdf')
      ) {
        try {
          const result = await pdf(att.content)
          if (result.text) {
            parts.push(`\n--- PDF: ${att.filename || 'attachment.pdf'} ---\n${result.text}`)
          }
        } catch (err) {
          log.warn({ err, filename: att.filename }, 'failed to parse PDF attachment')
        }
      }
    }
  }

  return parts.join('\n\n')
}
