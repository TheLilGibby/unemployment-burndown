/**
 * Connection error severity classification.
 *
 * Categorizes Plaid/SnapTrade errors into severity levels so the UI
 * can show appropriate actions (reconnect vs. wait vs. contact support).
 */

export const ErrorSeverity = {
  /** Credentials expired or need re-authentication — user can fix via reconnect */
  CREDENTIALS_EXPIRED: 'credentials_expired',
  /** Institution is temporarily unavailable — user should wait */
  INSTITUTION_DOWN: 'institution_down',
  /** Rate limit / budget exceeded — user should wait */
  RATE_LIMITED: 'rate_limited',
  /** Unknown or unrecoverable error */
  UNKNOWN: 'unknown',
}

/**
 * Classify an error message into a severity level.
 * @param {string} errorMessage - Error string from the API
 * @returns {{ severity: string, canReconnect: boolean, userMessage: string }}
 */
export function classifyConnectionError(errorMessage) {
  if (!errorMessage) return null

  const lower = errorMessage.toLowerCase()

  // Credential / token issues → user can reconnect
  if (
    lower.includes('invalid') ||
    lower.includes('expired') ||
    lower.includes('credentials') ||
    lower.includes('login_required') ||
    lower.includes('access token') ||
    lower.includes('re-authenticate') ||
    lower.includes('encrypted-or-corrupt') ||
    lower.includes('env-mismatch') ||
    lower.includes('disconnecting and reconnecting')
  ) {
    return {
      severity: ErrorSeverity.CREDENTIALS_EXPIRED,
      canReconnect: true,
      userMessage: 'Your bank credentials need to be updated. Click Reconnect to re-authenticate.',
    }
  }

  // Institution down
  if (
    lower.includes('institution') && (lower.includes('down') || lower.includes('unavailable')) ||
    lower.includes('planned_maintenance') ||
    lower.includes('institution_not_responding')
  ) {
    return {
      severity: ErrorSeverity.INSTITUTION_DOWN,
      canReconnect: false,
      userMessage: 'This institution is temporarily unavailable. Please try again later.',
    }
  }

  // Rate limited / budget exceeded
  if (
    lower.includes('budget') ||
    lower.includes('cooldown') ||
    lower.includes('rate limit') ||
    lower.includes('429')
  ) {
    return {
      severity: ErrorSeverity.RATE_LIMITED,
      canReconnect: false,
      userMessage: errorMessage,
    }
  }

  return {
    severity: ErrorSeverity.UNKNOWN,
    canReconnect: true,
    userMessage: errorMessage,
  }
}
