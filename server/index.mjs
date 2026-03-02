import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import crypto from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'
import { mapPlaidCategory } from '../backend/src/lib/plaidCategoryMap.mjs'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
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
const s3 = USE_LOCAL_DATA ? null : new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

// ── Auth (in-memory stores for local dev) ──
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'
const users = new Map()  // userId -> { userId, email, passwordHash, mfaEnabled, mfaSecret, orgId, orgRole }
const orgs = new Map()   // orgId -> { orgId, name, joinCode, ownerId, createdAt }
const orgMembers = new Map() // orgId -> [{ userId, role, joinedAt }]

function signJwt(userId, { mfaVerified = false, orgId = null, orgRole = null } = {}) {
  return jwt.sign({ sub: userId, mfaVerified, orgId, orgRole }, JWT_SECRET, { expiresIn: '24h' })
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

function generateOrgId() { return `org_${crypto.randomBytes(8).toString('hex')}` }
function generateJoinCode() { return crypto.randomBytes(4).toString('hex').toUpperCase() }

// ── S3 / local-file helpers (org-scoped) ──
function dataKey(orgId) { return orgId ? `orgs/${orgId}/data.json` : 'data.json' }
function statementsIndexKey(orgId) { return orgId ? `orgs/${orgId}/statements/index.json` : 'statements/index.json' }
function statementKey(orgId, id) { return orgId ? `orgs/${orgId}/statements/${id}.json` : `statements/${id}.json` }

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

    const orgOpts = { orgId: user.orgId || null, orgRole: user.orgRole || null }

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

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.get(req.user.sub)
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json({ userId: user.userId, email: user.email, mfaEnabled: user.mfaEnabled, orgId: user.orgId || null, orgRole: user.orgRole || null })
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
// PLAID ROUTES
// ═══════════════════════════════════════════════════════════════

const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SANDBOX_SECRET,
    },
  },
})

const plaidClient = new PlaidApi(config)

// ── Safety: max pagination pages (matches backend PLAID_MAX_SYNC_PAGES) ──
const MAX_SYNC_PAGES = parseInt(process.env.PLAID_MAX_SYNC_PAGES || '10', 10)

// ── Safety: in-memory per-item sync cooldown for dev server ──
const SYNC_COOLDOWN_MS = parseInt(process.env.PLAID_SYNC_COOLDOWN_SECONDS || '300', 10) * 1000
const lastSyncTimes = new Map()

// ── Safety: in-memory monthly call counter for dev server ──
const MONTHLY_BUDGET = parseFloat(process.env.PLAID_MONTHLY_BUDGET || '10')
const EST_COST_PER_CALL = parseFloat(process.env.PLAID_EST_COST_PER_CALL || '0.10')
const MAX_MONTHLY_CALLS = Math.floor(MONTHLY_BUDGET / EST_COST_PER_CALL)
let callCounter = { month: new Date().toISOString().slice(0, 7), count: 0 }

// ── In-memory store for linked Plaid items (dev server only) ──
// Map: orgId -> Map<itemId, { accessToken, cursor, institutionName, institutionId }>
const plaidItems = new Map()

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

    // Store item for sync route
    const orgId = req.user.orgId
    if (!plaidItems.has(orgId)) plaidItems.set(orgId, new Map())
    plaidItems.get(orgId).set(item_id, {
      accessToken: access_token,
      cursor: null,
      institutionName,
      institutionId: institutionId || null,
    })

    res.json({
      access_token,
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

// Fetch current balances for a linked institution
app.post('/api/plaid/balances', orgMiddleware, async (req, res) => {
  try {
    const { access_token } = req.body
    const response = await plaidClient.accountsBalanceGet({ access_token })
    res.json({
      accounts: response.data.accounts.map(a => ({
        account_id: a.account_id,
        balances: {
          current: a.balances.current,
          available: a.balances.available,
          limit: a.balances.limit,
        },
      })),
    })
  } catch (err) {
    req.log.error({ err, plaidError: err.response?.data }, 'balances fetch failed')
    res.status(500).json({ error: err.response?.data || err.message })
  }
})

// Fetch transactions using /transactions/sync for incremental sync
app.post('/api/plaid/transactions', orgMiddleware, async (req, res) => {
  try {
    // Budget check
    const budget = checkDevBudget()
    if (!budget.allowed) {
      return res.status(429).json({ error: `Monthly API budget exhausted (${budget.used}/${budget.limit} calls).` })
    }

    const { access_token, cursor } = req.body

    let allAdded = []
    let allModified = []
    let allRemoved = []
    let nextCursor = cursor || ''
    let hasMore = true
    let pageCount = 0

    while (hasMore && pageCount < MAX_SYNC_PAGES) {
      pageCount++
      recordDevCall()
      const response = await plaidClient.transactionsSync({
        access_token,
        cursor: nextCursor || undefined,
      })
      const data = response.data

      allAdded = allAdded.concat(data.added)
      allModified = allModified.concat(data.modified)
      allRemoved = allRemoved.concat(data.removed)
      nextCursor = data.next_cursor
      hasMore = data.has_more
    }

    if (hasMore) {
      req.log.warn({ pageLimit: MAX_SYNC_PAGES }, 'transactions sync hit page limit, remaining data will sync on next call')
    }

    res.json({
      added: allAdded.map(t => ({
        transaction_id: t.transaction_id,
        account_id: t.account_id,
        date: t.date,
        name: t.name,
        merchant_name: t.merchant_name,
        amount: t.amount,
        category: t.personal_finance_category
          ? [t.personal_finance_category.primary, t.personal_finance_category.detailed]
          : t.category || [],
        pending: t.pending,
      })),
      modified: allModified.map(t => ({
        transaction_id: t.transaction_id,
        account_id: t.account_id,
        date: t.date,
        name: t.name,
        merchant_name: t.merchant_name,
        amount: t.amount,
        category: t.personal_finance_category
          ? [t.personal_finance_category.primary, t.personal_finance_category.detailed]
          : t.category || [],
        pending: t.pending,
      })),
      removed: allRemoved.map(t => ({ transaction_id: t.transaction_id })),
      next_cursor: nextCursor,
    })
  } catch (err) {
    req.log.error({ err, plaidError: err.response?.data }, 'transactions sync failed')
    res.status(500).json({ error: err.response?.data || err.message })
  }
})

// Budget status endpoint (dev server)
app.get('/api/plaid/budget', authMiddleware, (req, res) => {
  const budget = checkDevBudget()
  res.json({
    ...budget,
    budgetDollars: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
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
        recordDevCall()
        const acctRes = await plaidClient.accountsGet({ access_token: itemData.accessToken })
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
          access_token: itemData.accessToken,
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
      const acctRes = await plaidClient.accountsGet({ access_token: itemData.accessToken })
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
        await plaidClient.itemRemove({ access_token: itemData.accessToken })
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
      const incomingIds = new Set(group.transactions.map(t => t.transaction_id))
      existing.transactions = existing.transactions.filter(
        t => !incomingIds.has(t.plaidTransactionId) && !removedIds.has(t.plaidTransactionId)
      )
      existing.transactions.push(...group.transactions.map(transformPlaidTxn))
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

const PORT = process.env.PLAID_SERVER_PORT || 3001
app.listen(PORT, () => {
  log.info({ port: PORT, dataMode: USE_LOCAL_DATA ? 'local' : 's3', ...(USE_LOCAL_DATA ? { localDir: LOCAL_DATA_DIR } : { bucket: S3_BUCKET }) }, 'dev server started')
})
