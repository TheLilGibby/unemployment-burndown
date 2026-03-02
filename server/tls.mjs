import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import selfsigned from 'selfsigned'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CERTS_DIR = resolve(__dirname, '..', '.certs')
const KEY_PATH = resolve(CERTS_DIR, 'localhost-key.pem')
const CERT_PATH = resolve(CERTS_DIR, 'localhost-cert.pem')

/**
 * Returns TLS key and cert for the dev server.
 * Generates a self-signed certificate if one doesn't exist.
 */
export async function getDevTlsCredentials() {
  if (!existsSync(KEY_PATH) || !existsSync(CERT_PATH)) {
    await generateSelfSignedCert()
  }

  return {
    key: readFileSync(KEY_PATH),
    cert: readFileSync(CERT_PATH),
  }
}

async function generateSelfSignedCert() {
  mkdirSync(CERTS_DIR, { recursive: true })

  const attrs = [{ name: 'commonName', value: 'localhost' }]
  const opts = {
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ],
  }

  const pems = await selfsigned.generate(attrs, opts)
  writeFileSync(KEY_PATH, pems.private)
  writeFileSync(CERT_PATH, pems.cert)
}
