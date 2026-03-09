const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email) {
  if (!email || !email.trim()) return 'Email is required'
  if (!EMAIL_RE.test(email.trim())) return 'Please enter a valid email address'
  return null
}

export function validatePassword(password, { isRegister = false } = {}) {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (isRegister) {
    if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter'
    if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter'
    if (!/[0-9]/.test(password)) return 'Password must include a number'
  }
  return null
}

export function validateOrgName(name) {
  if (!name || !name.trim()) return 'Organization name is required'
  const trimmed = name.trim()
  if (trimmed.length < 3) return 'Organization name must be at least 3 characters'
  if (trimmed.length > 50) return 'Organization name must be 50 characters or fewer'
  return null
}

export function validateAvatarFile(file) {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const MAX_SIZE_MB = 5
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Please upload a JPEG, PNG, GIF, or WebP image'
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `File size must be under ${MAX_SIZE_MB}MB`
  }
  return null
}
