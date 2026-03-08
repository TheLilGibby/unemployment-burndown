import express from 'express'
import https from 'node:https'
import cors from 'cors'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'
import { mapPlaidCategory } from '../backend/src/lib/plaidCategoryMap.mjs'
// @aws-sdk/client-s3 is loaded dynamically below so the server can start
// without the SDK installed (e.g. local-data dev mode).
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
const { generateSecret: _generateSecret, verifySync: _verifySync, generateURI: _generateURI } = _require('otplib')
// Compatibility shim — otplib v13 removed the `authenticator` named export
const authenticator = {
  generateSecret: () => _generateSecret(),
  keyuri: (accountName, issuer, secret) =>
    _generateURI({ strategy: 'totp', issuer, label: accountName, secret }),
  verify: ({ token, secret }) => {
    try { const r = _verifySync({ type: 'totp', token, secret }); return !!(r && r.valid) }
    catch { return false }
  },
}
import QRCode from 'qrcode'
import log, { requestLogger, createAuditLogger } from './logger.mjs'
import { getDevTlsCredentials } from './tls.mjs'
import { encrypt, decrypt, isEncryptionConfigured } from '../backend/src/lib/encryption.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env from project root (or parent repo root if in a worktree)
dotenv.config({ path: resolve(__dirname, '..', '.env') })
if (!process.env.PLAID_CLIENT_ID) {
  // Try parent repo path (for git worktree setups)
  const parentEnv = resolve(__dirname, '..', '..', '..', '..', '.env')
  if (existsSync(parentEnv)) dotenv.config({ path: parentEnv })
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(requestLogger)

// ── Local data mode: read/write from examples/ instead of S3 ──
const USE_LOCAL_DATA = process.env.USE_LOCAL_DATA === 'true'
const LOCAL_DATA_DIR = resolve(
  __dirname, '..', process.env.LOCAL_DATA_DIR || 'examples'
)

// ── S3 client for data proxy (skipped in local mode) ──
const S3_BUCKET = process.env.S3_BUCKET || 'rag-consulting-burndown'
const S3_REGION = process.env.AWS_REGION || 'us-west-1'
let s3 = null
let S3Client, GetObjectCommand, PutObjectCommand
if (!USE_LOCAL_DATA) {
  ;({ S3Client, GetObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3'))
  s3 = new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
}

// ── Auth (in-memory stores for local dev) ──
if (!process.env.JWT_SECRET) {
  log.warn('JWT_SECRET is not set — using insecure dev-only default. Do NOT use in production.')
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-DO-NOT-USE-IN-PROD'
const users = new Map()  // userId -> { userId, email, passwordHash, mfaEnabled, mfaSecret, orgId, orgRole }
const orgs = new Map()   // orgId -> { orgId, name, joinCode, ownerId, createdAt }
const orgMembers = new Map() // orgId -> [{ userId, role, joinedAt }]

function signJwt(userId, { mfaVerified = false, orgId = null, orgRole = null, isSuperAdmin = false, impersonatedBy = null, expiresIn = '24h' } = {}) {
  const payload = { sub: userId, mfaVerified, orgId, orgRole, isSuperAdmin }
  if (impersonatedBy) payload.impersonatedBy = impersonatedBy
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

function isSuperAdminEmail(email) {
  const list = (process.env.SUPER_ADMINS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}

function verifyJwt(token) {
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  const payload = verifyJwt(token)
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' })
  req.user = payload
  next()
}

function orgMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (!req.user.orgId) return res.status(403).json({ error: 'Organization membership required' })
    next()
  })
}

function superAdminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    const user = users.get(req.user.sub)
    if (!req.user.isSuperAdmin && !isSuperAdminEmail(req.user.sub) && !isSuperAdminEmail(user?.email || '')) {
      return res.status(403).json({ error: 'Superadmin access required' })
    }
    next()
  })
}

function generateOrgId() { return `org_${crypto.randomBytes(8).toString('hex')}` }
function generateJoinCode() { return crypto.randomBytes(4).toString('hex').toUpperCase() }

// ── S3 / local-file helpers (org-scoped) ──
function dataKey(orgId) { return orgId ? `orgs/${orgId}/data.json` : 'data.json' }
function statementsIndexKey(orgId) { return orgId ? `orgs/${orgId}/statements/index.json` : 'statements/index.json' }
function statementKey(orgId, id) { return orgId ? `orgs/${orgId}/statements/${id}.json` : `statements/${id}.json` }
function snapshotIndexKey(orgId) { return orgId ? `orgs/${orgId}/snapshots/index.json` : 'snapshots/index.json' }
function snapshotKey(orgId, date) { return orgId ? `orgs/${orgId}/snapshots/${date}.json` : `snapshots/${date}.json` }

async function s3Get(key) {
  if (USE_LOCAL_DATA) {
    const filePath = resolve(LOCAL_DATA_DIR, key)
    if (!existsSync(filePath)) {
      const err = new Error(`Local file not found: ${filePath}`)
      err.name = 'NoSuchKey'
      throw err
    }
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  }
  const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
  return JSON.parse(await res.Body.transformToString('utf-8'))
}

async function s3Put(key, data) {
  if (USE_LOCAL_DATA) {
    const filePath = resolve(LOCAL_DATA_DIR, key)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(data, null, 2))
    return
  }
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }))
}

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
    const userId = email.toLowerCase()
    if (users.has(userId)) return res.status(409).json({ error: 'An account with this email already exists' })
    const passwordHash = await bcrypt.hash(password, 12)
    users.set(userId, { userId, email: userId, passwordHash, mfaEnabled: false, mfaSecret: null, orgId: null, orgRole: null })
    const token = signJwt(userId, { mfaVerified: false, orgId: null, orgRole: null })
    res.json({ token, user: { userId, email: userId, mfaEnabled: false, orgId: null, orgRole: null } })
  } catch (err) {
    req.log.error({ err }, 'registration failed')
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    const userId = email.toLowerCase()
    const user = users.get(userId)
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const isSuperAdmin = isSuperAdminEmail(user.email)
    const orgOpts = { orgId: user.orgId || null, orgRole: user.orgRole || null, isSuperAdmin }

    if (user.mfaEnabled) {
      const tempToken = signJwt(userId, { mfaVerified: false, ...orgOpts })
      return res.json({ mfaRequired: true, tempToken })
    }
    const token = signJwt(userId, { mfaVerified: true, ...orgOpts })
    res.json({ token, user: { userId, email: user.email, mfaEnabled: user.mfaEnabled, ...orgOpts } })
  } catch (err) {
    req.log.error({ err }, 'login failed')
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/verify-mfa
app.post('/api/auth/verify-mfa', authMiddleware, (req, res) => {
  const { code } = req.body
  if (!code) return res.status(400).json({ error: 'MFA code is required' })
  const user = users.get(req.user.sub)
  if (!user || !user.mfaEnabled || !user.mfaSecret) return res.status(400).json({ error: 'MFA is not enabled' })
  const isValid = authenticator.verify({ token: code, secret: user.mfaSecret })
  if (!isValid) return res.status(401).json({ error: 'Invalid MFA code' })
  const token = signJwt(user.userId, { mfaVerified: true, orgId: user.orgId, orgRole: user.orgRole })
  res.json({ token, user: { userId: user.userId, email: user.email, mfaEnabled: true, orgId: user.orgId, orgRole: user.orgRole } })
})

// POST /api/auth/setup-mfa
app.post('/api/auth/setup-mfa', authMiddleware, async (req, res) => {
  const user = users.get(req.user.sub)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const secret = authenticator.generateSecret()
  const otpauth = authenticator.keyuri(user.email, 'BurndownTracker', secret)
  const qrCode = await QRCode.toDataURL(otpauth)
  res.json({ secret, qrCode, otpauth })
})

// POST /api/auth/enable-mfa
app.post('/api/auth/enable-mfa', authMiddleware, (req, res) => {
  const { secret, code } = req.body
  if (!secret || !code) return res.status(400).json({ error: 'Secret and code are required' })
  const isValid = authenticator.verify({ token: code, secret })
  if (!isValid) return res.status(400).json({ error: 'Invalid code. Please try again.' })
  const user = users.get(req.user.sub)
  user.mfaEnabled = true
  user.mfaSecret = secret
  res.json({ mfaEnabled: true })
})

// POST /api/auth/dev-login — quick login for local development only
if (USE_LOCAL_DATA) {
  app.post('/api/auth/dev-login', async (req, res) => {
    try {
      const email = 'test@test.com'
      const password = 'qwerqwer'
      const userId = email

      // Auto-register if user doesn't exist
      if (!users.has(userId)) {
        const passwordHash = await bcrypt.hash(password, 12)
        users.set(userId, { userId, email, passwordHash, mfaEnabled: false, mfaSecret: null, orgId: null, orgRole: null })
      }

      const user = users.get(userId)
      const token = signJwt(userId, { mfaVerified: true, orgId: user.orgId || null, orgRole: user.orgRole || null })
      res.json({ token, user: { userId, email: user.email, mfaEnabled: user.mfaEnabled, orgId: user.orgId || null, orgRole: user.orgRole || null } })
    } catch (err) {
      req.log.error({ err }, 'dev-login failed')
      res.status(500).json({ error: 'Dev login failed' })
    }
  })
}

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.get(req.user.sub)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({
    userId: user.userId,
    email: user.email,
    mfaEnabled: user.mfaEnabled,
    orgId: user.orgId || null,
    orgRole: user.orgRole || null,
    profileColor: user.profileColor || 'blue',
    avatarDataUrl: user.avatarDataUrl || null,
    isSuperAdmin: isSuperAdminEmail(user.email),
    impersonatedBy: req.user.impersonatedBy || null,
  })
})

// POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', async (req, res) => {
  const GENERIC_MSG = 'If an account with that email exists, a password reset link has been sent.'
  try {
    const { email } = req.body
    if (!email) return res.json({ message: GENERIC_MSG })

    const userId = email.toLowerCase()
    const user = users.get(userId)
    if (!user) {
      return res.json({ message: GENERIC_MSG })
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    user.resetTokenHash = tokenHash
    user.resetTokenExpiry = expiry

    const APP_URL = process.env.APP_URL || 'http://localhost:5173'
    const resetUrl = `${APP_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`
    req.log.info({ resetUrl }, 'DEV: Password reset link')

    res.json({ message: GENERIC_MSG })
  } catch (err) {
    req.log.error({ err }, 'forgot-password failed')
    res.json({ message: GENERIC_MSG })
  }
})

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, token, password } = req.body
    if (!email || !token || !password) {
      return res.status(400).json({ error: 'Email, token, and new password are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const userId = email.toLowerCase()
    const user = users.get(userId)
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' })

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    if (!user.resetTokenHash || user.resetTokenHash !== tokenHash) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }
    if (!user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
      user.resetTokenHash = null
      user.resetTokenExpiry = null
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    user.passwordHash = await bcrypt.hash(password, 12)
    user.resetTokenHash = null
    user.resetTokenExpiry = null

    res.json({ message: 'Password has been reset successfully. You can now sign in.' })
  } catch (err) {
    req.log.error({ err }, 'reset-password failed')
    res.status(500).json({ error: 'Password reset failed' })
  }
})

// POST /api/auth/delete-account — permanently delete user account and all data
app.post('/api/auth/delete-account', authMiddleware, async (req, res) => {
  try {
    const user = users.get(req.user.sub)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const orgId = user.orgId

    // 1. Revoke all Plaid access tokens for the org and clean up
    if (orgId) {
      const orgItemMap = plaidItems.get(orgId)
      if (orgItemMap) {
        for (const [itemId, itemData] of orgItemMap) {
          try {
            await plaidClient.itemRemove({ access_token: decryptToken(itemData.accessToken) })
          } catch { /* tolerate failure */ }
          lastSyncTimes.delete(itemId)
        }
        plaidItems.delete(orgId)
      }

      // 2. Delete org data from S3/local storage
      if (USE_LOCAL_DATA) {
        const orgDir = resolve(LOCAL_DATA_DIR, 'orgs', orgId)
        const { rmSync } = await import('fs')
        try { rmSync(orgDir, { recursive: true, force: true }) } catch { /* ok */ }
      } else {
        try {
          const { ListObjectsV2Command, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
          const prefix = `orgs/${orgId}/`
          let continuationToken
          do {
            const listRes = await s3.send(new ListObjectsV2Command({
              Bucket: S3_BUCKET, Prefix: prefix, ContinuationToken: continuationToken,
            }))
            if (listRes.Contents) {
              for (const obj of listRes.Contents) {
                await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: obj.Key }))
              }
            }
            continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined
          } while (continuationToken)
        } catch (s3Err) {
          req.log.warn({ err: s3Err, orgId }, 'S3 cleanup failed during account deletion')
        }
      }

      // 3. Clean up org membership
      orgs.delete(orgId)
      orgMembers.delete(orgId)
    }

    // 4. Delete the user record
    users.delete(req.user.sub)

    req.log.info({ userId: user.userId, orgId }, 'account deleted')
    res.json({ deleted: true })
  } catch (err) {
    req.log.error({ err }, 'account deletion failed')
    res.status(500).json({ error: 'Account deletion failed. Please contact privacy@rag-consulting.com for assistance.' })
  }
})

// ═══════════════════════════════════════════════════════════════
// PRIVACY / CONSENT ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/privacy/consent — record user consent for audit trail
app.post('/api/privacy/consent', authMiddleware, (req, res) => {
  try {
    const { consentType, consentVersion } = req.body
    const validTypes = ['plaid_data_access', 'privacy_policy', 'account_registration']
    if (!consentType || !validTypes.includes(consentType)) {
      return res.status(400).json({ error: `consentType must be one of: ${validTypes.join(', ')}` })
    }

    const user = users.get(req.user.sub)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const consentRecord = {
      consentType,
      consentVersion: consentVersion || '1.0',
      grantedAt: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || null,
    }

    if (!user.consentRecords) user.consentRecords = []
    user.consentRecords.push(consentRecord)

    req.log.info({ userId: user.userId, consentType, consentVersion }, 'consent recorded')
    res.json({ recorded: true, consent: consentRecord })
  } catch (err) {
    req.log.error({ err }, 'consent recording failed')
    res.status(500).json({ error: 'Failed to record consent' })
  }
})

// ═══════════════════════════════════════════════════════════════
// ORG ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/org/create
app.post('/api/org/create', authMiddleware, async (req, res) => {
  try {
    const user = users.get(req.user.sub)
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.orgId) return res.status(409).json({ error: 'You already belong to an organization' })

    const { name } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Organization name is required' })

    const orgId = generateOrgId()
    const joinCode = generateJoinCode()
    const now = new Date().toISOString()

    orgs.set(orgId, { orgId, name: name.trim(), joinCode, ownerId: user.userId, createdAt: now })
    orgMembers.set(orgId, [{ userId: user.userId, role: 'owner', joinedAt: now }])

    user.orgId = orgId
    user.orgRole = 'owner'

    // Initialize data.json for this org
    // In local mode, seed from examples/data.json so templates & sample data are available
    let initialData
    if (USE_LOCAL_DATA) {
      const examplePath = resolve(LOCAL_DATA_DIR, 'data.json')
      if (existsSync(examplePath)) {
        initialData = JSON.parse(readFileSync(examplePath, 'utf-8'))
        // Update the first person to match the registering user
        if (initialData.state && initialData.state.people && initialData.state.people.length > 0) {
          initialData.state.people[0] = {
            ...initialData.state.people[0],
            name: user.email.split('@')[0],
            linkedUserId: user.userId,
            email: user.email,
          }
        }
        initialData.savedAt = now
      }
    }
    if (!initialData) {
      initialData = {
        state: {
          people: [
            { id: 1, name: user.email.split('@')[0], color: '#3b82f6', linkedUserId: user.userId, email: user.email },
          ],
          monthlyIncome: 0,
          savingsAccounts: [],
          creditCards: [],
          bills: [],
          expenses: [],
        },
        savedAt: now,
      }
    }
    await s3Put(dataKey(orgId), initialData)

    const token = signJwt(user.userId, { mfaVerified: req.user.mfaVerified, orgId, orgRole: 'owner' })
    res.json({
      token,
      org: { orgId, name: name.trim(), joinCode },
      user: { userId: user.userId, email: user.email, mfaEnabled: user.mfaEnabled, orgId, orgRole: 'owner' },
    })
  } catch (err) {
    req.log.error({ err }, 'org creation failed')
    res.status(500).json({ error: 'Failed to create organization' })
  }
})

// POST /api/org/join
app.post('/api/org/join', authMiddleware, async (req, res) => {
  try {
    const user = users.get(req.user.sub)
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.orgId) return res.status(409).json({ error: 'You already belong to an organization' })

    const { joinCode } = req.body
    if (!joinCode || !joinCode.trim()) return res.status(400).json({ error: 'Join code is required' })

    // Find org by join code
    let org = null
    for (const o of orgs.values()) {
      if (o.joinCode === joinCode.trim().toUpperCase()) { org = o; break }
    }
    if (!org) return res.status(404).json({ error: 'Invalid join code' })

    const members = orgMembers.get(org.orgId) || []
    if (members.find(m => m.userId === user.userId)) {
      return res.status(409).json({ error: 'You are already a member of this organization' })
    }

    members.push({ userId: user.userId, role: 'member', joinedAt: new Date().toISOString() })
    orgMembers.set(org.orgId, members)

    user.orgId = org.orgId
    user.orgRole = 'member'

    // Add as person in data.json
    try {
      const data = await s3Get(dataKey(org.orgId))
      if (data && data.state) {
        const maxId = (data.state.people || []).reduce((max, p) => Math.max(max, p.id || 0), 0)
        data.state.people = data.state.people || []
        data.state.people.push({
          id: maxId + 1,
          name: user.email.split('@')[0],
          color: '#8b5cf6',
          linkedUserId: user.userId,
          email: user.email,
        })
        data.savedAt = new Date().toISOString()
        await s3Put(dataKey(org.orgId), data)
      }
    } catch (e) {
      req.log.warn({ err: e }, 'could not update data.json for join')
    }

    const token = signJwt(user.userId, { mfaVerified: req.user.mfaVerified, orgId: org.orgId, orgRole: 'member' })
    res.json({
      token,
      org: { orgId: org.orgId, name: org.name },
      user: { userId: user.userId, email: user.email, mfaEnabled: user.mfaEnabled, orgId: org.orgId, orgRole: 'member' },
    })
  } catch (err) {
    req.log.error({ err }, 'org join failed')
    res.status(500).json({ error: 'Failed to join organization' })
  }
})

// GET /api/org
app.get('/api/org', orgMiddleware, (req, res) => {
  const org = orgs.get(req.user.orgId)
  if (!org) return res.status(404).json({ error: 'Organization not found' })

  const members = (orgMembers.get(req.user.orgId) || []).map(m => {
    const u = users.get(m.userId)
    return { userId: m.userId, email: u?.email || m.userId, role: m.role, joinedAt: m.joinedAt }
  })

  const response = { orgId: org.orgId, name: org.name, createdAt: org.createdAt, members }
  if (req.user.orgRole === 'owner') response.joinCode = org.joinCode

  res.json(response)
})

// POST /api/org/regenerate-code
app.post('/api/org/regenerate-code', orgMiddleware, (req, res) => {
  if (req.user.orgRole !== 'owner') return res.status(403).json({ error: 'Only the owner can regenerate the join code' })
  const org = orgs.get(req.user.orgId)
  if (!org) return res.status(404).json({ error: 'Organization not found' })
  org.joinCode = generateJoinCode()
  res.json({ joinCode: org.joinCode })
})

// ═══════════════════════════════════════════════════════════════
// SUPERADMIN ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/orgs — list all organizations with member counts
app.get('/api/admin/orgs', superAdminMiddleware, (req, res) => {
  const allOrgs = Array.from(orgs.values()).map(org => {
    const members = orgMembers.get(org.orgId) || []
    return {
      orgId: org.orgId,
      name: org.name,
      ownerId: org.ownerId,
      memberCount: members.length,
      createdAt: org.createdAt,
    }
  })
  res.json({ orgs: allOrgs })
})

// GET /api/admin/orgs/:orgId — org detail with member list
app.get('/api/admin/orgs/:orgId', superAdminMiddleware, (req, res) => {
  const org = orgs.get(req.params.orgId)
  if (!org) return res.status(404).json({ error: 'Organization not found' })

  const members = (orgMembers.get(org.orgId) || []).map(m => {
    const u = users.get(m.userId)
    return {
      userId: m.userId,
      email: u?.email || m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      mfaEnabled: u?.mfaEnabled || false,
      createdAt: u?.createdAt,
    }
  })

  res.json({
    orgId: org.orgId,
    name: org.name,
    joinCode: org.joinCode,
    ownerId: org.ownerId,
    createdAt: org.createdAt,
    members,
  })
})

// GET /api/admin/users — list all users
app.get('/api/admin/users', superAdminMiddleware, (req, res) => {
  const allUsers = Array.from(users.values()).map(u => ({
    userId: u.userId,
    email: u.email,
    orgId: u.orgId || null,
    orgRole: u.orgRole || null,
    mfaEnabled: u.mfaEnabled || false,
    createdAt: u.createdAt,
  }))
  res.json({ users: allUsers })
})

// POST /api/admin/impersonate — generate impersonation token
app.post('/api/admin/impersonate', superAdminMiddleware, (req, res) => {
  const { targetUserId } = req.body
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' })

  const targetUser = users.get(targetUserId)
  if (!targetUser) return res.status(404).json({ error: 'Target user not found' })

  req.log.warn({ adminUserId: req.user.sub, targetUserId }, 'superadmin started impersonation')

  const impersonationToken = signJwt(targetUser.userId, {
    mfaVerified: false,
    orgId: targetUser.orgId || null,
    orgRole: targetUser.orgRole || null,
    isSuperAdmin: false,
    impersonatedBy: req.user.sub,
    expiresIn: '1h',
  })

  res.json({
    token: impersonationToken,
    user: {
      userId: targetUser.userId,
      email: targetUser.email,
      orgId: targetUser.orgId || null,
      orgRole: targetUser.orgRole || null,
      mfaEnabled: targetUser.mfaEnabled,
    },
  })
})

// POST /api/admin/reset-plaid-budget — reset monthly API call counter to 0
app.post('/api/admin/reset-plaid-budget', superAdminMiddleware, (req, res) => {
  const previousCount = callCounter.count
  const month = callCounter.month
  req.log.warn({ adminUserId: req.user.sub, previousCount, month }, 'superadmin reset Plaid API budget counter to 0')
  callCounter.count = 0
  const budget = checkDevBudget()
  res.json({
    reset: true,
    month,
    previousCount,
    ...budget,
    budgetDollars: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
  })
})

// GET /api/admin/connection-status — aggregated Plaid connection status across all orgs
app.get('/api/admin/connection-status', superAdminMiddleware, (req, res) => {
  const institutions = []
  let totalAccounts = 0
  let hasError = false
  let latestSync = null

  for (const [orgId, orgItems] of plaidItems) {
    for (const [itemId, itemData] of orgItems) {
      const itemLastSync = lastSyncTimes.get(itemId) || null
      if (itemLastSync && (!latestSync || new Date(itemLastSync) > new Date(latestSync))) {
        latestSync = itemLastSync
      }
      institutions.push({
        id: itemId,
        orgId,
        name: itemData.institutionName || 'Unknown',
        institutionId: itemData.institutionId || null,
        lastSync: itemLastSync,
        accountCount: 0, // We don't store account counts in-memory; clients can enrich
        error: false,
      })
    }
  }

  res.json({
    institutions,
    totalAccounts,
    totalStatements: 0,
    hasError,
    lastSync: latestSync,
  })
})

// GET /api/admin/plaid-limits — get current Plaid API limit configuration
app.get('/api/admin/plaid-limits', superAdminMiddleware, (req, res) => {
  res.json({
    monthlyBudget: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
    maxSyncPages: MAX_SYNC_PAGES,
    syncCooldownSeconds: SYNC_COOLDOWN_MS / 1000,
    maxMonthlyCalls: MAX_MONTHLY_CALLS,
  })
})

// PUT /api/admin/plaid-limits — update Plaid API limit configuration
app.put('/api/admin/plaid-limits', superAdminMiddleware, (req, res) => {
  const before = {
    monthlyBudget: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
    maxSyncPages: MAX_SYNC_PAGES,
    syncCooldownSeconds: SYNC_COOLDOWN_MS / 1000,
    maxMonthlyCalls: MAX_MONTHLY_CALLS,
  }
  const { monthlyBudget, estCostPerCall, maxSyncPages, syncCooldownSeconds } = req.body
  if (monthlyBudget !== undefined) {
    const val = parseFloat(monthlyBudget)
    if (isNaN(val) || val < 0 || val > 10000) return res.status(400).json({ error: 'monthlyBudget must be between 0 and 10000' })
    MONTHLY_BUDGET = val
  }
  if (estCostPerCall !== undefined) {
    const val = parseFloat(estCostPerCall)
    if (isNaN(val) || val <= 0 || val > 100) return res.status(400).json({ error: 'estCostPerCall must be between 0.01 and 100' })
    EST_COST_PER_CALL = val
  }
  if (maxSyncPages !== undefined) {
    const val = parseInt(maxSyncPages, 10)
    if (isNaN(val) || val < 1 || val > 100) return res.status(400).json({ error: 'maxSyncPages must be between 1 and 100' })
    MAX_SYNC_PAGES = val
  }
  if (syncCooldownSeconds !== undefined) {
    const val = parseInt(syncCooldownSeconds, 10)
    if (isNaN(val) || val < 0 || val > 86400) return res.status(400).json({ error: 'syncCooldownSeconds must be between 0 and 86400' })
    SYNC_COOLDOWN_MS = val * 1000
  }
  MAX_MONTHLY_CALLS = Math.floor(MONTHLY_BUDGET / EST_COST_PER_CALL)
  req.log.warn({ adminUserId: req.user.sub, before, updates: req.body }, 'superadmin updated Plaid API limits')
  const after = {
    monthlyBudget: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
    maxSyncPages: MAX_SYNC_PAGES,
    syncCooldownSeconds: SYNC_COOLDOWN_MS / 1000,
    maxMonthlyCalls: MAX_MONTHLY_CALLS,
  }
  res.json({ updated: true, before, after })
})

// ═══════════════════════════════════════════════════════════════
// SNAPTRADE ADMIN ROUTES (in-memory for dev)
// ═══════════════════════════════════════════════════════════════

let ST_MONTHLY_BUDGET = 15
let ST_EST_COST_PER_CALL = 0.50
let ST_MAX_SYNC_PAGES = 10
let ST_SYNC_COOLDOWN_MS = 300_000
let ST_MAX_MONTHLY_CALLS = Math.floor(ST_MONTHLY_BUDGET / ST_EST_COST_PER_CALL)
let stCallCounter = { count: 0, month: new Date().toISOString().slice(0, 7) }

function checkSnapTradeBudget() {
  const now = new Date().toISOString().slice(0, 7)
  if (now !== stCallCounter.month) { stCallCounter = { count: 0, month: now } }
  const remaining = Math.max(0, ST_MAX_MONTHLY_CALLS - stCallCounter.count)
  return { used: stCallCounter.count, limit: ST_MAX_MONTHLY_CALLS, remaining }
}

app.get('/api/snaptrade/budget', authMiddleware, (req, res) => {
  const budget = checkSnapTradeBudget()
  res.json({
    ...budget,
    allowed: budget.remaining > 0,
    budgetDollars: ST_MONTHLY_BUDGET,
    estCostPerCall: ST_EST_COST_PER_CALL,
    maxSyncPages: ST_MAX_SYNC_PAGES,
    syncCooldownSeconds: ST_SYNC_COOLDOWN_MS / 1000,
    month: stCallCounter.month,
  })
})

app.get('/api/admin/snaptrade-limits', superAdminMiddleware, (req, res) => {
  res.json({
    monthlyBudget: ST_MONTHLY_BUDGET,
    estCostPerCall: ST_EST_COST_PER_CALL,
    maxSyncPages: ST_MAX_SYNC_PAGES,
    syncCooldownSeconds: ST_SYNC_COOLDOWN_MS / 1000,
    maxMonthlyCalls: ST_MAX_MONTHLY_CALLS,
  })
})

app.put('/api/admin/snaptrade-limits', superAdminMiddleware, (req, res) => {
  const before = {
    monthlyBudget: ST_MONTHLY_BUDGET,
    estCostPerCall: ST_EST_COST_PER_CALL,
    maxSyncPages: ST_MAX_SYNC_PAGES,
    syncCooldownSeconds: ST_SYNC_COOLDOWN_MS / 1000,
    maxMonthlyCalls: ST_MAX_MONTHLY_CALLS,
  }
  const { monthlyBudget, estCostPerCall, maxSyncPages, syncCooldownSeconds } = req.body
  if (monthlyBudget !== undefined) ST_MONTHLY_BUDGET = parseFloat(monthlyBudget)
  if (estCostPerCall !== undefined) ST_EST_COST_PER_CALL = parseFloat(estCostPerCall)
  if (maxSyncPages !== undefined) ST_MAX_SYNC_PAGES = parseInt(maxSyncPages, 10)
  if (syncCooldownSeconds !== undefined) ST_SYNC_COOLDOWN_MS = parseInt(syncCooldownSeconds, 10) * 1000
  ST_MAX_MONTHLY_CALLS = Math.floor(ST_MONTHLY_BUDGET / ST_EST_COST_PER_CALL)
  const after = {
    monthlyBudget: ST_MONTHLY_BUDGET,
    estCostPerCall: ST_EST_COST_PER_CALL,
    maxSyncPages: ST_MAX_SYNC_PAGES,
    syncCooldownSeconds: ST_SYNC_COOLDOWN_MS / 1000,
    maxMonthlyCalls: ST_MAX_MONTHLY_CALLS,
  }
  res.json({ updated: true, before, after })
})

app.post('/api/admin/reset-snaptrade-budget', superAdminMiddleware, (req, res) => {
  const previousCount = stCallCounter.count
  stCallCounter.count = 0
  const budget = checkSnapTradeBudget()
  res.json({ reset: true, month: stCallCounter.month, previousCount, ...budget, budgetDollars: ST_MONTHLY_BUDGET, estCostPerCall: ST_EST_COST_PER_CALL })
})

// ═══════════════════════════════════════════════════════════════
// JOBS ROUTES (in-memory store for dev)
// ═══════════════════════════════════════════════════════════════

const jobsStore = new Map() // orgId -> Map<jobId, job>
let jobCounter = 0

function generateJobId() {
  jobCounter++
  return `job_${Date.now().toString(36)}_${jobCounter}`
}

// GET /api/jobs — list all jobs for the org
app.get('/api/jobs', orgMiddleware, (req, res) => {
  try {
    const orgJobs = jobsStore.get(req.user.orgId)
    const jobs = orgJobs ? Array.from(orgJobs.values()) : []
    res.json({ jobs })
  } catch (err) {
    req.log.error({ err }, 'list jobs failed')
    res.status(500).json({ error: 'Failed to list jobs' })
  }
})

// POST /api/jobs — create a new job
app.post('/api/jobs', orgMiddleware, (req, res) => {
  try {
    const { title, employer, monthlySalary, startDate, endDate, status, statusDate, assignedTo } = req.body

    if (!title && !employer) {
      return res.status(400).json({ error: 'Job title or employer is required' })
    }

    const orgId = req.user.orgId
    if (!jobsStore.has(orgId)) jobsStore.set(orgId, new Map())

    const jobId = generateJobId()
    const now = new Date().toISOString()
    const job = {
      orgId,
      jobId,
      userId: req.user.sub,
      title: title || '',
      employer: employer || '',
      monthlySalary: monthlySalary || 0,
      startDate: startDate || '',
      endDate: endDate || '',
      status: status || 'active',
      statusDate: statusDate || '',
      assignedTo: assignedTo || null,
      createdAt: now,
      updatedAt: now,
    }

    jobsStore.get(orgId).set(jobId, job)
    req.log.info({ userId: req.user.sub, jobId, title, employer }, 'job created')
    res.json({ job })
  } catch (err) {
    req.log.error({ err }, 'create job failed')
    res.status(500).json({ error: 'Failed to create job' })
  }
})

// PUT /api/jobs/:jobId — update a job
app.put('/api/jobs/:jobId', orgMiddleware, (req, res) => {
  try {
    const { jobId } = req.params
    const orgJobs = jobsStore.get(req.user.orgId)
    if (!orgJobs || !orgJobs.has(jobId)) {
      return res.status(404).json({ error: 'Job not found' })
    }

    const existing = orgJobs.get(jobId)
    const allowedFields = ['title', 'employer', 'monthlySalary', 'startDate', 'endDate', 'status', 'statusDate', 'assignedTo']
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        existing[field] = req.body[field]
      }
    }
    existing.updatedAt = new Date().toISOString()

    res.json({ job: existing })
  } catch (err) {
    req.log.error({ err }, 'update job failed')
    res.status(500).json({ error: 'Failed to update job' })
  }
})

// DELETE /api/jobs/:jobId — delete a job
app.delete('/api/jobs/:jobId', orgMiddleware, (req, res) => {
  try {
    const { jobId } = req.params
    const orgJobs = jobsStore.get(req.user.orgId)
    if (!orgJobs || !orgJobs.has(jobId)) {
      return res.status(404).json({ error: 'Job not found' })
    }

    orgJobs.delete(jobId)
    req.log.info({ userId: req.user.sub, jobId }, 'job deleted')
    res.json({ deleted: true, jobId })
  } catch (err) {
    req.log.error({ err }, 'delete job failed')
    res.status(500).json({ error: 'Failed to delete job' })
  }
})

// ═══════════════════════════════════════════════════════════════
// PLAID ROUTES
// ═══════════════════════════════════════════════════════════════

const PLAID_ENV_MAP = {
  sandbox:     PlaidEnvironments.sandbox,
  development: PlaidEnvironments.development,
  production:  PlaidEnvironments.production,
}
const config = new Configuration({
  basePath: PLAID_ENV_MAP[process.env.PLAID_ENV] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET || process.env.PLAID_SANDBOX_SECRET,
    },
  },
})

const plaidClient = new PlaidApi(config)

// ── Safety: mutable Plaid limits (defaults from env, overridable by superadmin) ──
let MAX_SYNC_PAGES = parseInt(process.env.PLAID_MAX_SYNC_PAGES || '10', 10)
let SYNC_COOLDOWN_MS = parseInt(process.env.PLAID_SYNC_COOLDOWN_SECONDS || '300', 10) * 1000
let MONTHLY_BUDGET = parseFloat(process.env.PLAID_MONTHLY_BUDGET || '10')
let EST_COST_PER_CALL = parseFloat(process.env.PLAID_EST_COST_PER_CALL || '0.10')
let MAX_MONTHLY_CALLS = Math.floor(MONTHLY_BUDGET / EST_COST_PER_CALL)

const lastSyncTimes = new Map()
let callCounter = { month: new Date().toISOString().slice(0, 7), count: 0 }

// ── In-memory store for linked Plaid items (dev server only) ──
// Map: orgId -> Map<itemId, { accessToken (encrypted if key set), cursor, institutionName, institutionId }>
const plaidItems = new Map()

const ACCESS_TOKEN_RE = /^access-(sandbox|development|production)-[a-f0-9-]+$/

function encryptToken(token) {
  if (!token || !isEncryptionConfigured()) return token
  return encrypt(token)
}
function decryptToken(token) {
  if (!token || !isEncryptionConfigured()) return token
  if (ACCESS_TOKEN_RE.test(token)) return token // already plaintext
  try { return decrypt(token) } catch (e) {
    log.warn('decryptToken failed — token may be corrupted or PLAID_ENCRYPTION_KEY changed')
    return token
  }
}
function isValidAccessToken(token) {
  return typeof token === 'string' && ACCESS_TOKEN_RE.test(token)
}

function checkDevBudget() {
  const currentMonth = new Date().toISOString().slice(0, 7)
  if (callCounter.month !== currentMonth) {
    callCounter = { month: currentMonth, count: 0 }
  }
  return {
    allowed: callCounter.count < MAX_MONTHLY_CALLS,
    used: callCounter.count,
    limit: MAX_MONTHLY_CALLS,
    remaining: Math.max(0, MAX_MONTHLY_CALLS - callCounter.count),
  }
}

function recordDevCall() {
  const currentMonth = new Date().toISOString().slice(0, 7)
  if (callCounter.month !== currentMonth) {
    callCounter = { month: currentMonth, count: 0 }
  }
  callCounter.count++
}

// Create a link token for Plaid Link (org-scoped)
const handleCreateLinkToken = async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.orgId },
      client_name: 'Burndown Tracker',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })
    res.json({ link_token: response.data.link_token })
  } catch (err) {
    req.log.error({ err, plaidError: err.response?.data }, 'create-link-token failed')
    res.status(500).json({ error: err.response?.data || err.message })
  }
}
app.post('/api/plaid/create-link-token', orgMiddleware, handleCreateLinkToken)
app.post('/api/plaid/link-token', orgMiddleware, handleCreateLinkToken)

// Exchange public_token for access_token and get accounts
const handleExchangeToken = async (req, res) => {
  try {
    const { public_token } = req.body

    // Exchange for access token
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token })
    const { access_token, item_id } = exchangeRes.data

    // Get account details
    const accountsRes = await plaidClient.accountsGet({ access_token })
    const accounts = accountsRes.data.accounts

    // Get institution name
    let institutionName = 'Unknown Bank'
    const institutionId = accountsRes.data.item?.institution_id
    if (institutionId) {
      try {
        const instRes = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        })
        institutionName = instRes.data.institution.name
      } catch {
        // Keep default name if institution lookup fails
      }
    }

    // Store item for sync route (access token encrypted at rest)
    const orgId = req.user.orgId
    if (!plaidItems.has(orgId)) plaidItems.set(orgId, new Map())
    plaidItems.get(orgId).set(item_id, {
      accessToken: encryptToken(access_token),
      cursor: null,
      institutionName,
      institutionId: institutionId || null,
    })

    res.json({
      item_id,
      institution_name: institutionName,
      // Also return fields the usePlaid hook expects from /plaid/exchange
      itemId: item_id,
      institutionName,
      institutionId: institutionId || null,
      accounts: accounts.map(a => ({
        account_id: a.account_id,
        id: a.account_id,
        name: a.name,
        official_name: a.official_name,
        officialName: a.official_name,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
        balances: {
          current: a.balances.current,
          available: a.balances.available,
          limit: a.balances.limit,
        },
        currentBalance: a.balances.current,
        availableBalance: a.balances.available,
        limit: a.balances.limit,
      })),
    })
  } catch (err) {
    req.log.error({ err, plaidError: err.response?.data }, 'exchange-token failed')
    res.status(500).json({ error: err.response?.data || err.message })
  }
}
app.post('/api/plaid/exchange-token', orgMiddleware, handleExchangeToken)
app.post('/api/plaid/exchange', orgMiddleware, handleExchangeToken)


// Budget status endpoint (dev server)
app.get('/api/plaid/budget', authMiddleware, (req, res) => {
  const budget = checkDevBudget()
  res.json({
    ...budget,
    budgetDollars: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
    maxSyncPages: MAX_SYNC_PAGES,
    syncCooldownSeconds: SYNC_COOLDOWN_MS / 1000,
    month: new Date().toISOString().slice(0, 7),
  })
})

// ── GET /api/plaid/accounts — list connected items with current account data ──
app.get('/api/plaid/accounts', orgMiddleware, async (req, res) => {
  try {
    const orgId = req.user.orgId
    const orgItems = plaidItems.get(orgId)
    if (!orgItems || orgItems.size === 0) {
      return res.json({ items: [] })
    }

    const items = []
    for (const [itemId, itemData] of orgItems) {
      try {
        const token = decryptToken(itemData.accessToken)
        if (!isValidAccessToken(token)) {
          req.log.warn({ itemId }, 'skipping item with invalid access token')
          items.push({ itemId, institutionName: itemData.institutionName, accounts: [], error: 'Access token is invalid. Try disconnecting and reconnecting this bank.' })
          continue
        }
        recordDevCall()
        const acctRes = await plaidClient.accountsGet({ access_token: token })
        items.push({
          itemId,
          institutionName: itemData.institutionName,
          institutionId: itemData.institutionId,
          lastSync: lastSyncTimes.get(itemId) || null,
          accounts: acctRes.data.accounts.map(a => ({
            id: a.account_id,
            name: a.name,
            officialName: a.official_name,
            type: a.type,
            subtype: a.subtype,
            mask: a.mask,
            currentBalance: a.balances.current,
            availableBalance: a.balances.available,
            limit: a.balances.limit,
          })),
        })
      } catch (e) {
        items.push({
          itemId,
          institutionName: itemData.institutionName,
          institutionId: itemData.institutionId,
          accounts: [],
          error: e.message,
        })
      }
    }

    res.json({ items })
  } catch (err) {
    req.log.error({ err }, 'accounts fetch failed')
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/plaid/sync — sync transactions + balances, persist as hub statements ──
app.post('/api/plaid/sync', orgMiddleware, async (req, res) => {
  try {
    const orgId = req.user.orgId
    const { itemId: requestedItemId } = req.body || {}

    // Budget check
    const budget = checkDevBudget()
    if (!budget.allowed) {
      return res.status(429).json({ error: `Monthly API budget exhausted (${budget.used}/${budget.limit} calls).` })
    }

    // Get items to sync
    const orgItemMap = plaidItems.get(orgId)
    if (!orgItemMap || orgItemMap.size === 0) {
      return res.json({ message: 'No connected accounts', updated: false })
    }

    let itemEntries = [...orgItemMap.entries()]
    if (requestedItemId) {
      itemEntries = itemEntries.filter(([id]) => id === requestedItemId)
      if (itemEntries.length === 0) {
        return res.status(404).json({ error: 'Item not found' })
      }
    }

    // Cooldown check
    for (const [itemId, itemData] of itemEntries) {
      const lastSync = lastSyncTimes.get(itemId)
      if (lastSync && (Date.now() - lastSync) < SYNC_COOLDOWN_MS) {
        const waitSec = Math.ceil((SYNC_COOLDOWN_MS - (Date.now() - lastSync)) / 1000)
        return res.status(429).json({ error: `Sync cooldown: please wait ${waitSec}s before syncing ${itemData.institutionName} again.` })
      }
    }

    // Read current data from S3
    let data
    try {
      data = await s3Get(dataKey(orgId))
    } catch (e) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) data = null
    }
    if (!data || !data.state) {
      return res.status(400).json({ error: 'No existing data found. Please save data from the app first.' })
    }

    const state = data.state
    if (!state.savingsAccounts) state.savingsAccounts = []
    if (!state.creditCards) state.creditCards = []
    if (!data.plaidMeta) data.plaidMeta = {}

    const allAccountUpdates = []
    const allSyncData = [] // per-item transaction data

    for (const [itemId, itemData] of itemEntries) {
      // ── Validate token before calling Plaid ──
      const token = decryptToken(itemData.accessToken)
      if (!isValidAccessToken(token)) {
        const looks = !token ? 'missing' : token.startsWith('access-') ? 'env-mismatch' : 'encrypted-or-corrupt'
        req.log.error({ itemId, looks }, 'access token is invalid — may be encrypted/corrupt or PLAID_ENV mismatch')
        return res.status(500).json({ error: `Access token for ${itemData.institutionName || itemId} is invalid (${looks}). Try disconnecting and reconnecting the bank account.` })
      }

      // ── Sync transactions (cursor-based) ──
      let cursor = itemData.cursor || null
      let hasMore = true
      let addedTxns = []
      let modifiedTxns = []
      let removedTxns = []
      let pageCount = 0

      while (hasMore && pageCount < MAX_SYNC_PAGES) {
        pageCount++
        recordDevCall()
        const syncRes = await plaidClient.transactionsSync({
          access_token: token,
          cursor: cursor || undefined,
          count: 500,
        })
        const syncData = syncRes.data

        addedTxns = addedTxns.concat(syncData.added || [])
        modifiedTxns = modifiedTxns.concat(syncData.modified || [])
        removedTxns = removedTxns.concat(syncData.removed || [])

        hasMore = syncData.has_more
        cursor = syncData.next_cursor
      }

      // Save cursor for incremental sync
      if (cursor) itemData.cursor = cursor

      // ── Fetch current balances ──
      recordDevCall()
      const acctRes = await plaidClient.accountsGet({ access_token: token })
      const plaidAccounts = acctRes.data.accounts

      for (const acct of plaidAccounts) {
        allAccountUpdates.push({
          plaidAccountId: acct.account_id,
          plaidItemId: itemId,
          institutionName: itemData.institutionName,
          name: acct.name,
          officialName: acct.official_name,
          type: acct.type,
          subtype: acct.subtype,
          mask: acct.mask,
          currentBalance: acct.balances.current,
          availableBalance: acct.balances.available,
          limit: acct.balances.limit,
        })

        // Map to data model
        if (acct.type === 'depository') {
          mapToSavingsAccount(state, acct)
        } else if (acct.type === 'credit') {
          mapToCreditCard(state, acct)
        }
      }

      allSyncData.push({
        itemId,
        institutionName: itemData.institutionName,
        addedTxns,
        modifiedTxns,
        removedTxns,
        plaidAccounts,
      })
    }

    // Update timestamps and write data
    data.plaidMeta.lastSync = new Date().toISOString()
    data.savedAt = new Date().toISOString()
    await s3Put(dataKey(orgId), data)

    // ── Persist transactions as hub statements in S3 ──
    let totalTxnsSynced = 0
    let totalTxnsRemoved = 0

    // Build cardId map
    const cardIdMap = {}
    for (const card of state.creditCards) {
      if (card.plaidAccountId) cardIdMap[card.plaidAccountId] = card.id
    }
    for (const acct of state.savingsAccounts) {
      if (acct.plaidAccountId) cardIdMap[acct.plaidAccountId] = acct.id
    }

    for (const syncItem of allSyncData) {
      const accountInfoMap = {}
      for (const acct of syncItem.plaidAccounts) {
        accountInfoMap[acct.account_id] = {
          name: acct.name,
          mask: acct.mask,
          type: acct.type,
          subtype: acct.subtype,
          institutionName: syncItem.institutionName,
        }
      }

      const { addedTxns, modifiedTxns, removedTxns } = syncItem
      if (addedTxns.length > 0 || modifiedTxns.length > 0 || removedTxns.length > 0) {
        await mergeStatementsFromPlaid(
          orgId, addedTxns, modifiedTxns, removedTxns, accountInfoMap, cardIdMap
        )
        totalTxnsSynced += addedTxns.length + modifiedTxns.length
        totalTxnsRemoved += removedTxns.length
      }
    }

    // Record cooldown
    for (const [itemId] of itemEntries) {
      lastSyncTimes.set(itemId, Date.now())
    }

    res.json({
      updated: true,
      accountsUpdated: allAccountUpdates.length,
      transactionsSynced: totalTxnsSynced,
      transactionsRemoved: totalTxnsRemoved,
      accounts: allAccountUpdates,
      data,
    })
  } catch (err) {
    req.log.error({ err, plaidError: err.response?.data }, 'sync failed')
    res.status(500).json({ error: err.response?.data?.error_message || err.message })
  }
})

// ── POST /api/plaid/disconnect — remove a linked item ──
app.post('/api/plaid/disconnect', orgMiddleware, async (req, res) => {
  try {
    const { itemId } = req.body
    if (!itemId) return res.status(400).json({ error: 'itemId is required' })

    const orgId = req.user.orgId
    const orgItemMap = plaidItems.get(orgId)
    const itemData = orgItemMap?.get(itemId)

    if (itemData) {
      try {
        await plaidClient.itemRemove({ access_token: decryptToken(itemData.accessToken) })
      } catch { /* tolerate failure */ }
      orgItemMap.delete(itemId)
    }

    lastSyncTimes.delete(itemId)
    res.json({ success: true, itemId })
  } catch (err) {
    req.log.error({ err }, 'disconnect failed')
    res.status(500).json({ error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// SNAPTRADE ROUTES (mock for dev server)
// ═══════════════════════════════════════════════════════════════

const snaptradeConnections = new Map() // orgId -> Map<connectionId, connectionData>

// POST /api/snaptrade/connect — generate mock redirect URL for brokerage connection
app.post('/api/snaptrade/connect', orgMiddleware, (req, res) => {
  const { broker } = req.body
  const mockRedirectUrl = `https://app.snaptrade.com/connect?broker=${broker || 'FIDELITY'}&userId=${req.user.orgId}&dev=true`
  res.json({
    redirectUrl: mockRedirectUrl,
    broker: broker || 'FIDELITY',
  })
})

// POST /api/snaptrade/callback — handle mock callback after brokerage connection
app.post('/api/snaptrade/callback', orgMiddleware, (req, res) => {
  const { authorizationId } = req.body
  if (!authorizationId) return res.status(400).json({ error: 'authorizationId is required' })

  const orgId = req.user.orgId
  if (!snaptradeConnections.has(orgId)) snaptradeConnections.set(orgId, new Map())
  const orgConns = snaptradeConnections.get(orgId)

  const connectionId = authorizationId || `st_conn_${Date.now()}`
  const mockConnection = {
    id: connectionId,
    brokerage: 'Fidelity',
    brokerageId: 'FIDELITY',
    status: 'CONNECTED',
    createdAt: new Date().toISOString(),
  }
  orgConns.set(connectionId, mockConnection)

  const mockAccounts = [
    {
      id: `st_acct_401k_${Date.now()}`,
      name: 'Fidelity 401(k)',
      number: '****1234',
      type: 'investment',
      institution: 'Fidelity',
      institutionId: 'FIDELITY',
      currency: 'USD',
      totalValue: 145230.50,
      cashBalance: 2150.00,
      holdings: [
        { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', quantity: 250, price: 268.45, value: 67112.50, currency: 'USD' },
        { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', quantity: 300, price: 58.20, value: 17460.00, currency: 'USD' },
        { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', quantity: 400, price: 72.30, value: 28920.00, currency: 'USD' },
        { symbol: 'FXAIX', name: 'Fidelity 500 Index Fund', quantity: 180, price: 175.88, value: 31658.40, currency: 'USD' },
      ],
      lastSync: new Date().toISOString(),
    },
    {
      id: `st_acct_ira_${Date.now()}`,
      name: 'Fidelity Roth IRA',
      number: '****5678',
      type: 'investment',
      institution: 'Fidelity',
      institutionId: 'FIDELITY',
      currency: 'USD',
      totalValue: 52840.25,
      cashBalance: 840.25,
      holdings: [
        { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', quantity: 50, price: 510.30, value: 25515.00, currency: 'USD' },
        { symbol: 'QQQ', name: 'Invesco QQQ Trust', quantity: 30, price: 495.00, value: 14850.00, currency: 'USD' },
        { symbol: 'AAPL', name: 'Apple Inc.', quantity: 40, price: 190.88, value: 7635.20, currency: 'USD' },
      ],
      lastSync: new Date().toISOString(),
    },
  ]

  res.json({
    authorizationId: connectionId,
    connection: mockConnection,
    accounts: mockAccounts,
    connectedBy: req.user.sub,
  })
})

// GET /api/snaptrade/accounts — list connected investment accounts
app.get('/api/snaptrade/accounts', orgMiddleware, (req, res) => {
  const orgConns = snaptradeConnections.get(req.user.orgId)
  if (!orgConns || orgConns.size === 0) {
    return res.json({ accounts: [], fromCache: false })
  }

  const mockAccounts = [
    {
      id: 'st_acct_401k_mock',
      name: 'Fidelity 401(k)',
      number: '****1234',
      type: 'investment',
      institution: 'Fidelity',
      institutionId: 'FIDELITY',
      currency: 'USD',
      totalValue: 145230.50,
      cashBalance: 2150.00,
      holdings: [
        { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', quantity: 250, price: 268.45, value: 67112.50, currency: 'USD' },
        { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', quantity: 300, price: 58.20, value: 17460.00, currency: 'USD' },
        { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', quantity: 400, price: 72.30, value: 28920.00, currency: 'USD' },
        { symbol: 'FXAIX', name: 'Fidelity 500 Index Fund', quantity: 180, price: 175.88, value: 31658.40, currency: 'USD' },
      ],
      lastSync: new Date().toISOString(),
    },
    {
      id: 'st_acct_ira_mock',
      name: 'Fidelity Roth IRA',
      number: '****5678',
      type: 'investment',
      institution: 'Fidelity',
      institutionId: 'FIDELITY',
      currency: 'USD',
      totalValue: 52840.25,
      cashBalance: 840.25,
      holdings: [
        { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', quantity: 50, price: 510.30, value: 25515.00, currency: 'USD' },
        { symbol: 'QQQ', name: 'Invesco QQQ Trust', quantity: 30, price: 495.00, value: 14850.00, currency: 'USD' },
        { symbol: 'AAPL', name: 'Apple Inc.', quantity: 40, price: 190.88, value: 7635.20, currency: 'USD' },
      ],
      lastSync: new Date().toISOString(),
    },
  ]

  res.json({ accounts: mockAccounts, cachedAt: new Date().toISOString(), fromCache: true })
})

// POST /api/snaptrade/sync — sync investment holdings
app.post('/api/snaptrade/sync', orgMiddleware, (req, res) => {
  stCallCounter.count++

  const mockAccounts = [
    {
      id: 'st_acct_401k_mock',
      name: 'Fidelity 401(k)',
      number: '****1234',
      type: 'investment',
      institution: 'Fidelity',
      institutionId: 'FIDELITY',
      currency: 'USD',
      totalValue: 145230.50 + (Math.random() * 1000 - 500),
      cashBalance: 2150.00,
      holdings: [
        { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', quantity: 250, price: 268.45 + Math.random() * 5, value: 0, currency: 'USD' },
        { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', quantity: 300, price: 58.20 + Math.random() * 2, value: 0, currency: 'USD' },
        { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', quantity: 400, price: 72.30 + Math.random(), value: 0, currency: 'USD' },
        { symbol: 'FXAIX', name: 'Fidelity 500 Index Fund', quantity: 180, price: 175.88 + Math.random() * 3, value: 0, currency: 'USD' },
      ],
      lastSync: new Date().toISOString(),
    },
    {
      id: 'st_acct_ira_mock',
      name: 'Fidelity Roth IRA',
      number: '****5678',
      type: 'investment',
      institution: 'Fidelity',
      institutionId: 'FIDELITY',
      currency: 'USD',
      totalValue: 52840.25 + (Math.random() * 300 - 150),
      cashBalance: 840.25,
      holdings: [
        { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', quantity: 50, price: 510.30 + Math.random() * 10, value: 0, currency: 'USD' },
        { symbol: 'QQQ', name: 'Invesco QQQ Trust', quantity: 30, price: 495.00 + Math.random() * 8, value: 0, currency: 'USD' },
        { symbol: 'AAPL', name: 'Apple Inc.', quantity: 40, price: 190.88 + Math.random() * 4, value: 0, currency: 'USD' },
      ],
      lastSync: new Date().toISOString(),
    },
  ]

  // Fix up value fields
  for (const acct of mockAccounts) {
    for (const h of acct.holdings) {
      h.value = Math.round(h.quantity * h.price * 100) / 100
      h.price = Math.round(h.price * 100) / 100
    }
    acct.totalValue = Math.round(acct.holdings.reduce((s, h) => s + h.value, 0) * 100) / 100 + acct.cashBalance
  }

  res.json({ updated: true, accounts: mockAccounts, syncedAt: new Date().toISOString() })
})

// DELETE /api/snaptrade/connections/:connectionId — disconnect a brokerage
app.delete('/api/snaptrade/connections/:connectionId', orgMiddleware, (req, res) => {
  const orgConns = snaptradeConnections.get(req.user.orgId)
  if (orgConns) orgConns.delete(req.params.connectionId)
  res.json({ disconnected: true, connectionId: req.params.connectionId })
})

// ── Helpers: balance-mapping for dev server sync ──

function mapToSavingsAccount(state, plaidAcct) {
  const plaidId = plaidAcct.account_id
  const balance = plaidAcct.balances.available ?? plaidAcct.balances.current ?? 0

  let existing = state.savingsAccounts.find(a => a.plaidAccountId === plaidId)
  if (!existing) {
    const plaidName = (plaidAcct.official_name || plaidAcct.name || '').toLowerCase()
    existing = state.savingsAccounts.find(a =>
      !a.plaidAccountId && a.name && plaidName.includes(a.name.toLowerCase())
    )
  }

  if (existing) {
    existing.amount = Math.round(balance * 100) / 100
    existing.plaidAccountId = plaidId
    existing.plaidLastSync = new Date().toISOString()
  } else {
    const displayName = plaidAcct.official_name || plaidAcct.name || 'Linked Account'
    const subtypeLabel = plaidAcct.subtype
      ? ` (${plaidAcct.subtype.charAt(0).toUpperCase() + plaidAcct.subtype.slice(1)})`
      : ''
    state.savingsAccounts.push({
      id: Date.now() + Math.random(),
      name: `${displayName}${subtypeLabel}`,
      amount: Math.round(balance * 100) / 100,
      active: true,
      assignedTo: null,
      plaidAccountId: plaidId,
      plaidLastSync: new Date().toISOString(),
    })
  }
}

function mapToCreditCard(state, plaidAcct) {
  const plaidId = plaidAcct.account_id
  const balance = Math.abs(plaidAcct.balances.current ?? 0)
  const limit = plaidAcct.balances.limit ?? 0

  let existing = state.creditCards.find(c => c.plaidAccountId === plaidId)
  if (!existing) {
    const plaidName = (plaidAcct.official_name || plaidAcct.name || '').toLowerCase()
    existing = state.creditCards.find(c =>
      !c.plaidAccountId && c.name && plaidName.includes(c.name.toLowerCase())
    )
  }

  if (existing) {
    existing.balance = Math.round(balance * 100) / 100
    existing.creditLimit = Math.round(limit * 100) / 100
    existing.plaidAccountId = plaidId
    existing.plaidLastSync = new Date().toISOString()
  } else {
    const displayName = plaidAcct.official_name || plaidAcct.name || 'Linked Card'
    state.creditCards.push({
      id: Date.now() + Math.random(),
      name: displayName,
      balance: Math.round(balance * 100) / 100,
      minimumPayment: 0,
      creditLimit: Math.round(limit * 100) / 100,
      apr: 0,
      statementCloseDay: '',
      assignedTo: null,
      plaidAccountId: plaidId,
      plaidLastSync: new Date().toISOString(),
    })
  }
}

// ── Helper: merge Plaid transactions into S3 statements (dev server version) ──

function transformPlaidTxn(plaidTxn) {
  return {
    id: `plaid_txn_${plaidTxn.transaction_id}`,
    date: plaidTxn.date,
    description: plaidTxn.name,
    merchantName: plaidTxn.merchant_name || plaidTxn.name,
    category: mapPlaidCategory(plaidTxn.personal_finance_category),
    amount: plaidTxn.amount,
    isRefund: plaidTxn.amount < 0,
    pending: plaidTxn.pending || false,
    plaidTransactionId: plaidTxn.transaction_id,
  }
}

function lastDayOfMonth(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

async function mergeStatementsFromPlaid(orgId, added, modified, removed, accountInfoMap, cardIdMap) {
  const allUpserts = [...added, ...modified]
  const removedIds = new Set(removed.map(r => r.transaction_id))

  // Group by account + month
  const groups = new Map()
  for (const txn of allUpserts) {
    const month = txn.date.slice(0, 7)
    const key = `${txn.account_id}_${month}`
    if (!groups.has(key)) groups.set(key, { accountId: txn.account_id, month, transactions: [] })
    groups.get(key).transactions.push(txn)
  }

  // Read current index
  let index
  try {
    index = await s3Get(statementsIndexKey(orgId))
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) index = null
  }
  if (!index) index = { version: 1, lastUpdated: null, statements: [] }

  const touchedIds = new Set()

  for (const [, group] of groups) {
    const stmtId = `plaid_${group.accountId}_${group.month}`
    const accountInfo = accountInfoMap[group.accountId] || {}
    const cardId = cardIdMap[group.accountId] || null

    let existing = null
    try { existing = await s3Get(statementKey(orgId, stmtId)) } catch { /* new statement */ }

    if (existing) {
      // Build a map of user-modified transactions so we can preserve their overrides
      const userModifiedMap = new Map()
      for (const t of existing.transactions) {
        if (t.userModified && t.plaidTransactionId) {
          userModifiedMap.set(t.plaidTransactionId, t)
        }
      }

      const incomingIds = new Set(group.transactions.map(t => t.transaction_id))
      existing.transactions = existing.transactions.filter(
        t => !incomingIds.has(t.plaidTransactionId) && !removedIds.has(t.plaidTransactionId)
      )
      // Append fresh versions, preserving user-modified fields
      const freshTxns = group.transactions.map(plaidTxn => {
        const transformed = transformPlaidTxn(plaidTxn)
        const prior = userModifiedMap.get(plaidTxn.transaction_id)
        if (prior && prior.userModifiedFields?.length) {
          for (const field of prior.userModifiedFields) {
            transformed[field] = prior[field]
          }
          transformed.userModified = true
          transformed.userModifiedAt = prior.userModifiedAt
          transformed.userModifiedFields = prior.userModifiedFields
        }
        return transformed
      })
      existing.transactions.push(...freshTxns)
      existing.transactions.sort((a, b) => a.date.localeCompare(b.date))
      existing.statementBalance = Math.round(existing.transactions.reduce((s, t) => s + t.amount, 0) * 100) / 100
      existing.syncedAt = new Date().toISOString()
      await s3Put(statementKey(orgId, stmtId), existing)
    } else {
      const txns = group.transactions.map(transformPlaidTxn).sort((a, b) => a.date.localeCompare(b.date))
      const stmt = {
        id: stmtId,
        cardId,
        plaidAccountId: group.accountId,
        issuer: accountInfo.institutionName || 'Plaid',
        cardLastFour: accountInfo.mask || null,
        accountName: accountInfo.name || 'Linked Account',
        accountType: accountInfo.type,
        accountSubtype: accountInfo.subtype,
        statementPeriodStart: `${group.month}-01`,
        statementPeriodEnd: lastDayOfMonth(group.month),
        closingDate: lastDayOfMonth(group.month),
        statementBalance: Math.round(txns.reduce((s, t) => s + t.amount, 0) * 100) / 100,
        transactions: txns,
        source: 'plaid',
        syncedAt: new Date().toISOString(),
      }
      await s3Put(statementKey(orgId, stmtId), stmt)
    }
    touchedIds.add(stmtId)
  }

  // Handle removals for untouched statements
  if (removedIds.size > 0) {
    for (const entry of index.statements) {
      if (!entry.id.startsWith('plaid_') || touchedIds.has(entry.id)) continue
      let stmt = null
      try { stmt = await s3Get(statementKey(orgId, entry.id)) } catch { continue }
      if (!stmt) continue
      const before = stmt.transactions.length
      stmt.transactions = stmt.transactions.filter(t => !removedIds.has(t.plaidTransactionId))
      if (stmt.transactions.length !== before) {
        stmt.statementBalance = Math.round(stmt.transactions.reduce((s, t) => s + t.amount, 0) * 100) / 100
        stmt.syncedAt = new Date().toISOString()
        await s3Put(statementKey(orgId, entry.id), stmt)
        touchedIds.add(entry.id)
      }
    }
  }

  // Rebuild index for touched IDs
  index.statements = index.statements.filter(s => !touchedIds.has(s.id))
  for (const stmtId of touchedIds) {
    let stmt = null
    try { stmt = await s3Get(statementKey(orgId, stmtId)) } catch { continue }
    if (!stmt || stmt.transactions.length === 0) continue
    index.statements.push({
      id: stmt.id,
      cardId: stmt.cardId,
      plaidAccountId: stmt.plaidAccountId,
      issuer: stmt.issuer,
      closingDate: stmt.closingDate,
      statementBalance: stmt.statementBalance,
      transactionCount: stmt.transactions.length,
      parsedAt: stmt.syncedAt,
      source: 'plaid',
      accountName: stmt.accountName,
      accountType: stmt.accountType,
    })
  }
  index.lastUpdated = new Date().toISOString()
  await s3Put(statementsIndexKey(orgId), index)
}

// ═══════════════════════════════════════════════════════════════
// DATA API (S3 proxy — org-scoped)
// ═══════════════════════════════════════════════════════════════

// GET /api/data — read data.json
app.get('/api/data', orgMiddleware, async (req, res) => {
  try {
    const data = await s3Get(dataKey(req.user.orgId))
    res.json(data)
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.json(null)
    }
    req.log.error({ err }, 'GET /api/data failed')
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/data — write data.json
app.put('/api/data', orgMiddleware, async (req, res) => {
  try {
    await s3Put(dataKey(req.user.orgId), req.body)
    res.json({ saved: true, savedAt: new Date().toISOString() })
  } catch (err) {
    req.log.error({ err }, 'PUT /api/data failed')
    res.status(500).json({ error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// SNAPSHOT API — daily historical burndown snapshots
// ═══════════════════════════════════════════════════════════════

// GET /api/snapshots — list available snapshot dates for this org
app.get('/api/snapshots', orgMiddleware, async (req, res) => {
  try {
    const data = await s3Get(snapshotIndexKey(req.user.orgId))
    res.json(data || { version: 1, dates: [] })
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.json({ version: 1, dates: [] })
    }
    req.log.error({ err }, 'GET /api/snapshots failed')
    res.status(500).json({ error: err.message })
  }
})

// GET /api/snapshots/:date — fetch state snapshot for a specific YYYY-MM-DD date
app.get('/api/snapshots/:date', orgMiddleware, async (req, res) => {
  const { date } = req.params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' })
  }
  try {
    const data = await s3Get(snapshotKey(req.user.orgId, date))
    res.json(data)
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Snapshot not found for this date' })
    }
    req.log.error({ err }, 'GET /api/snapshots/:date failed')
    res.status(500).json({ error: err.message })
  }
})

// POST /api/snapshots — save a daily snapshot (idempotent: once per calendar day)
app.post('/api/snapshots', orgMiddleware, async (req, res) => {
  const orgId = req.user.orgId
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
  try {
    // Load or initialise the index
    let index = { version: 1, dates: [] }
    try {
      index = (await s3Get(snapshotIndexKey(orgId))) || index
    } catch (err) {
      if (err.name !== 'NoSuchKey' && err.$metadata?.httpStatusCode !== 404) throw err
    }

    // Only write once per day; subsequent saves that day are no-ops
    const alreadyExisted = index.dates.includes(today)
    if (!alreadyExisted) {
      const snapshot = {
        capturedAt: new Date().toISOString(),
        date: today,
        state: req.body,
      }
      await s3Put(snapshotKey(orgId, today), snapshot)
      index.dates = [...index.dates, today].sort()
      await s3Put(snapshotIndexKey(orgId), index)
    }

    res.json({ saved: true, date: today, alreadyExisted })
  } catch (err) {
    req.log.error({ err }, 'POST /api/snapshots failed')
    res.status(500).json({ error: err.message })
  }
})

// GET /api/statements — statements index
app.get('/api/statements', orgMiddleware, async (req, res) => {
  try {
    const data = await s3Get(statementsIndexKey(req.user.orgId))
    res.json(data)
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.json({ version: 1, lastUpdated: null, statements: [] })
    }
    req.log.error({ err }, 'GET /api/statements failed')
    res.status(500).json({ error: err.message })
  }
})

// GET /api/statements/:id — single statement
app.get('/api/statements/:id', orgMiddleware, async (req, res) => {
  try {
    const data = await s3Get(statementKey(req.user.orgId, req.params.id))
    res.json(data)
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Statement not found' })
    }
    req.log.error({ err }, 'GET /api/statements/:id failed')
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/statements/:statementId/transactions/:transactionId — update a transaction and mark as user-modified
app.patch('/api/statements/:statementId/transactions/:transactionId', orgMiddleware, async (req, res) => {
  const orgId = req.user.orgId
  const { statementId, transactionId } = req.params
  const allowedFields = ['category', 'isPayroll', 'payrollJobId']
  const updates = {}
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field]
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  try {
    const stmt = await s3Get(statementKey(orgId, statementId))
    if (!stmt) return res.status(404).json({ error: 'Statement not found' })

    const txnIndex = stmt.transactions.findIndex(t => t.id === transactionId)
    if (txnIndex === -1) return res.status(404).json({ error: 'Transaction not found in statement' })

    const txn = stmt.transactions[txnIndex]
    Object.assign(txn, updates)
    txn.userModified = true
    txn.userModifiedAt = new Date().toISOString()
    txn.userModifiedFields = [
      ...new Set([...(txn.userModifiedFields || []), ...Object.keys(updates)])
    ]
    stmt.transactions[txnIndex] = txn
    await s3Put(statementKey(orgId, statementId), stmt)
    res.json({ updated: true, transaction: txn })
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Statement not found' })
    }
    req.log.error({ err }, 'PATCH transaction failed')
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/statements/by-account/:cardId — remove all statements for a given account
app.delete('/api/statements/by-account/:cardId', orgMiddleware, async (req, res) => {
  const orgId = req.user.orgId
  const cardId = Number(req.params.cardId)
  try {
    let index
    try {
      index = await s3Get(statementsIndexKey(orgId))
    } catch (e) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
        return res.json({ deleted: 0 })
      }
      throw e
    }
    const toRemove = (index.statements || []).filter(s => s.cardId === cardId)
    if (toRemove.length === 0) return res.json({ deleted: 0 })

    // Delete individual statement files
    for (const stmt of toRemove) {
      try {
        if (USE_LOCAL_DATA) {
          const { unlinkSync } = await import('fs')
          const filePath = resolve(LOCAL_DATA_DIR, statementKey(orgId, stmt.id))
          try { unlinkSync(filePath) } catch { /* ok if missing */ }
        } else {
          const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
          await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: statementKey(orgId, stmt.id) }))
        }
      } catch { /* best effort */ }
    }

    // Update the index
    index.statements = (index.statements || []).filter(s => s.cardId !== cardId)
    index.lastUpdated = new Date().toISOString()
    await s3Put(statementsIndexKey(orgId), index)

    req.log.info({ cardId, count: toRemove.length }, 'Deleted statements for account')
    res.json({ deleted: toRemove.length })
  } catch (err) {
    req.log.error({ err }, 'DELETE /api/statements/by-account failed')
    res.status(500).json({ error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════
// FEEDBACK ROUTE
// ═══════════════════════════════════════════════════════════════

const FEEDBACK_REPO = 'RAG-Consulting-LLC/unemployment-burndown'
const FEEDBACK_LABEL_MAP = {
  bug: 'bug',
  feature: 'feature request',
  task: 'question',
}

function formatFeedbackBody(description, screenshotMd, metadata) {
  const parts = [description]
  if (screenshotMd) parts.push(screenshotMd)
  if (metadata) {
    parts.push('')
    parts.push('<details><summary>Environment</summary>')
    parts.push('')
    parts.push('| Field | Value |')
    parts.push('|-------|-------|')
    if (metadata.url) parts.push(`| Page URL | ${metadata.url} |`)
    if (metadata.timestamp) parts.push(`| Timestamp | ${metadata.timestamp} |`)
    if (metadata.browser) parts.push(`| Browser | ${metadata.browser} |`)
    if (metadata.os) parts.push(`| OS | ${metadata.os} |`)
    if (metadata.viewport) parts.push(`| Viewport | ${metadata.viewport} |`)
    if (metadata.screenResolution) parts.push(`| Screen | ${metadata.screenResolution} |`)
    if (metadata.devicePixelRatio) parts.push(`| DPR | ${metadata.devicePixelRatio} |`)
    if (metadata.language) parts.push(`| Language | ${metadata.language} |`)
    parts.push('')
    parts.push('</details>')
  }
  parts.push('')
  parts.push('---')
  parts.push('*Submitted via in-app feedback widget*')
  return parts.join('\n')
}

// POST /api/feedback — create a GitHub issue from in-app feedback
app.post('/api/feedback', async (req, res) => {
  try {
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      return res.status(503).json({ error: 'Feedback service is not configured' })
    }

    const { category, description, screenshot, metadata } = req.body
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' })
    }

    // Always tag as external; add category-specific label
    const labels = ['external']
    if (category && FEEDBACK_LABEL_MAP[category]) labels.push(FEEDBACK_LABEL_MAP[category])

    const title = description.trim().slice(0, 100)

    // Step 1: Create the issue WITHOUT screenshot (guarantees creation)
    const issueBody = formatFeedbackBody(description.trim(), '', metadata)

    const ghRes = await fetch(`https://api.github.com/repos/${FEEDBACK_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body: issueBody, labels }),
    })

    if (!ghRes.ok) {
      const text = await ghRes.text()
      req.log.error({ status: ghRes.status, body: text }, 'GitHub API error')
      return res.status(502).json({ error: 'Failed to create issue' })
    }

    const issue = await ghRes.json()
    req.log.info({ issueNumber: issue.number }, 'feedback issue created')

    // Step 2: If screenshot provided, upload and update the issue body
    if (screenshot) {
      try {
        const base64 = screenshot.replace(/^data:image\/\w+;base64,/, '')
        const ext = screenshot.startsWith('data:image/png') ? 'png' : 'jpg'
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const path = `.github/feedback-screenshots/${filename}`

        const uploadRes = await fetch(`https://api.github.com/repos/${FEEDBACK_REPO}/contents/${path}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ message: `feedback screenshot: ${filename}`, content: base64 }),
        })

        if (uploadRes.ok) {
          const data = await uploadRes.json()
          const imageUrl = data.content?.download_url
            || `https://raw.githubusercontent.com/${FEEDBACK_REPO}/main/${path}`
          const screenshotMd = `\n\n![Screenshot](${imageUrl})`
          const updatedBody = formatFeedbackBody(description.trim(), screenshotMd, metadata)

          await fetch(`https://api.github.com/repos/${FEEDBACK_REPO}/issues/${issue.number}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ body: updatedBody }),
          })
          req.log.info({ issueNumber: issue.number }, 'issue updated with screenshot')
        } else {
          req.log.warn({ status: uploadRes.status }, 'screenshot upload failed')
        }
      } catch (uploadErr) {
        req.log.warn({ err: uploadErr }, 'screenshot upload error')
      }
    }

    res.json({ created: true, issueNumber: issue.number, url: issue.html_url })
  } catch (err) {
    req.log.error({ err }, 'feedback submission failed')
    res.status(500).json({ error: 'Failed to submit feedback' })
  }
})

const PORT = process.env.PLAID_SERVER_PORT || 3001

// ── HTTPS with TLS 1.2+ ──
const tlsCreds = await getDevTlsCredentials()
const server = https.createServer(
  {
    key: tlsCreds.key,
    cert: tlsCreds.cert,
    minVersion: 'TLSv1.2',
  },
  app,
)

server.listen(PORT, () => {
  log.info({ port: PORT, tls: true, minTlsVersion: 'TLSv1.2', dataMode: USE_LOCAL_DATA ? 'local' : 's3', ...(USE_LOCAL_DATA ? { localDir: LOCAL_DATA_DIR } : { bucket: S3_BUCKET }) }, 'dev server started (HTTPS)')
})
