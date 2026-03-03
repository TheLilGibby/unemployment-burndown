import { execSync } from 'child_process'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CERTS_DIR = resolve(__dirname, '..', '.certs')
const KEY_PATH = resolve(CERTS_DIR, 'localhost-key.pem')
const CERT_PATH = resolve(CERTS_DIR, 'localhost-cert.pem')

/**
 * Returns TLS key and cert for the dev server, or null if certs
 * cannot be generated (e.g. openssl not installed on Windows).
 */
export function getDevTlsCredentials() {
  if (!existsSync(KEY_PATH) || !existsSync(CERT_PATH)) {
    const ok = generateSelfSignedCert()
    if (!ok) return null
  }

  return {
    key: readFileSync(KEY_PATH),
    cert: readFileSync(CERT_PATH),
  }
}

function generateSelfSignedCert() {
  mkdirSync(CERTS_DIR, { recursive: true })

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" ` +
      `-days 365 -nodes -subj "/CN=localhost" ` +
      `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { stdio: 'pipe' }
    )
    return true
  } catch {
    // openssl not available (common on Windows) — fall back to HTTP
    return false
  }
}
