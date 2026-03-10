/**
 * Named constants for magic numbers used across financial calculations.
 *
 * Centralising these values makes the intent clear, simplifies tuning,
 * and prevents subtle bugs when the same threshold appears in multiple files.
 */

// ── Time conversions ──────────────────────────────────────────────────
/** Average weeks in a calendar month (52 weeks / 12 months). */
export const WEEKS_PER_MONTH = 52 / 12

// ── Goal tracking ─────────────────────────────────────────────────────
/** A goal is considered "on track" if the monthly contribution covers at
 *  least this fraction of the required amount (i.e. 5 % tolerance). */
export const GOAL_ON_TRACK_TOLERANCE = 0.95

// ── Retirement projection ─────────────────────────────────────────────
/** Maximum age (in years) to project retirement balances through. */
export const MAX_PROJECTION_AGE = 100

// ── Transfer pair detection ───────────────────────────────────────────
/** Maximum number of calendar days between two transactions for them to
 *  be considered a matching transfer pair. */
export const TRANSFER_MAX_DAY_GAP = 2

// ── Credit-card payment detection ─────────────────────────────────────
/** Fractional tolerance when matching a bank transaction amount to a
 *  credit-card statement balance (2 %). */
export const CC_PAYMENT_STATEMENT_TOLERANCE = 0.02

/** Fractional tolerance when matching a bank transaction amount to a
 *  credit-card current balance (5 %). */
export const CC_PAYMENT_BALANCE_TOLERANCE = 0.05

// ── Notifications ─────────────────────────────────────────────────────
/** Debounce delay (ms) before re-evaluating notification state. */
export const NOTIFICATION_DEBOUNCE_MS = 3000
