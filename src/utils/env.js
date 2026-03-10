/**
 * Centralized environment variable validation.
 *
 * All VITE_* env vars should be read here and exported as named constants.
 * Import this module early (e.g. from main.jsx) so that missing-variable
 * warnings surface at startup rather than at first use.
 */

const isDev = import.meta.env.DEV

/**
 * Read a VITE_ environment variable by suffix name.
 * @param {string} name  - The part after "VITE_" (e.g. "PLAID_API_URL")
 * @param {{ required?: boolean }} options
 * @returns {string}
 */
function getEnvVar(name, { required = false } = {}) {
  const key = `VITE_${name}`
  const value = import.meta.env[key]

  if (!value) {
    if (required) {
      console.error(
        `[env] Required environment variable ${key} is not set. ` +
          'Some features may not work correctly.',
      )
    } else if (!isDev) {
      // In production builds, warn about missing optional vars so operators
      // can spot misconfigurations in deploy logs.
      console.warn(`[env] Optional environment variable ${key} is not set.`)
    }
  }

  return value || ''
}

// ---------------------------------------------------------------------------
// Exported constants — add new VITE_* vars here
// ---------------------------------------------------------------------------

/**
 * Base URL for all API requests (backend origin).
 * Required in production; in dev mode Vite's proxy handles /api routes so
 * an empty string is acceptable.
 */
export const API_BASE = getEnvVar('PLAID_API_URL', { required: !isDev })

/**
 * Whether the backend API is configured.
 * Useful as a feature-flag to conditionally render sections that depend on
 * a running backend (e.g. Plaid bank sync, SnapTrade brokerages).
 */
export const HAS_API = Boolean(import.meta.env.VITE_PLAID_API_URL)
