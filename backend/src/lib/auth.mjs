import jwt from 'jsonwebtoken'

const WEAK_DEFAULTS = ['change-me-in-production', 'dev-secret-change-in-prod']
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || WEAK_DEFAULTS.includes(JWT_SECRET)) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set to a strong, unique value')
}
const JWT_EXPIRES_IN = '24h'

/**
 * Check if a userId/email is in the SUPER_ADMINS env var allowlist.
 */
export function isEnvSuperAdmin(email) {
  const list = (process.env.SUPER_ADMINS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.toLowerCase())
}

/**
 * Create a signed JWT for a user.
 */
export function signToken(userId, { mfaVerified = false, orgId = null, orgRole = null, isSuperAdmin = false, tier = 'free', impersonatedBy = null, expiresIn = JWT_EXPIRES_IN } = {}) {
  const payload = { sub: userId, mfaVerified, orgId, orgRole, isSuperAdmin, tier }
  if (impersonatedBy) payload.impersonatedBy = impersonatedBy
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

/**
 * Verify and decode a JWT. Returns the payload or null if invalid.
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

/**
 * Extract the JWT from an API Gateway event's Authorization header.
 * Supports "Bearer <token>" format.
 */
export function extractToken(event) {
  const header = event.headers?.Authorization || event.headers?.authorization || ''
  if (header.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return header || null
}

/**
 * Auth middleware for Lambda handlers.
 * Returns the decoded user payload or an error response.
 */
export function requireAuth(event, { requireMfa = false } = {}) {
  const token = extractToken(event)
  if (!token) {
    return { error: { statusCode: 401, message: 'Authentication required' } }
  }

  const payload = verifyToken(token)
  if (!payload) {
    return { error: { statusCode: 401, message: 'Invalid or expired token' } }
  }

  if (requireMfa && !payload.mfaVerified) {
    return { error: { statusCode: 403, message: 'MFA verification required' } }
  }

  return { user: payload }
}

/**
 * Auth middleware that also requires the user to belong to an organization.
 * Returns { user } with orgId/orgRole guaranteed, or { error }.
 */
export function requireOrg(event) {
  const result = requireAuth(event)
  if (result.error) return result

  if (!result.user.orgId) {
    return { error: { statusCode: 403, message: 'Organization membership required' } }
  }

  return result
}

/**
 * Auth middleware that requires the caller to be a superadmin.
 * Checks both the JWT isSuperAdmin claim and the SUPER_ADMINS env var.
 */
export function requireSuperAdmin(event) {
  const result = requireAuth(event)
  if (result.error) return result

  if (!result.user.isSuperAdmin && !isEnvSuperAdmin(result.user.sub)) {
    return { error: { statusCode: 403, message: 'Superadmin access required' } }
  }

  return result
}

/**
 * Auth middleware that requires the user to have a premium tier.
 * Returns { user } with tier guaranteed to be 'premium', or { error }.
 */
export function requirePremium(event) {
  const result = requireAuth(event)
  if (result.error) return result

  if (result.user.tier !== 'premium') {
    return { error: { statusCode: 403, message: 'Premium subscription required' } }
  }

  return result
}
