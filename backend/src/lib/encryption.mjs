import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * Derives a 256-bit key from the PLAID_ENCRYPTION_KEY env var.
 * Uses SHA-256 so any-length passphrase produces a valid AES-256 key.
 */
function getKey() {
  const raw = process.env.PLAID_ENCRYPTION_KEY
  if (!raw) throw new Error('PLAID_ENCRYPTION_KEY environment variable is required')
  return crypto.createHash('sha256').update(raw).digest()
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string: iv + authTag + ciphertext.
 */
export function encrypt(plaintext) {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypts a base64-encoded string produced by encrypt().
 * Returns the original plaintext.
 */
export function decrypt(encoded) {
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8')
}

/**
 * Returns true if the PLAID_ENCRYPTION_KEY env var is configured.
 */
export function isEncryptionConfigured() {
  return !!process.env.PLAID_ENCRYPTION_KEY
}
