import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.TOKENS_TABLE || 'PlaidTokens'

// ── Budget configuration ──
// Monthly budget in dollars (default $10)
export const MONTHLY_BUDGET = parseFloat(process.env.PLAID_MONTHLY_BUDGET || '10')
// Estimated cost per Plaid API call in dollars (default $0.10)
export const EST_COST_PER_CALL = parseFloat(process.env.PLAID_EST_COST_PER_CALL || '0.10')
// Derived max calls per month
export const MAX_MONTHLY_CALLS = Math.floor(MONTHLY_BUDGET / EST_COST_PER_CALL)
// Max pagination pages in a single transactionsSync loop (default 10)
export const MAX_SYNC_PAGES = parseInt(process.env.PLAID_MAX_SYNC_PAGES || '10', 10)
// Minimum seconds between syncs for the same item (default 5 minutes)
export const SYNC_COOLDOWN_MS = parseInt(process.env.PLAID_SYNC_COOLDOWN_SECONDS || '300', 10) * 1000

// ── DynamoDB client (reuse across invocations) ──
let _docClient = null

function getDocClient() {
  if (_docClient) return _docClient
  const client = new DynamoDBClient({})
  _docClient = DynamoDBDocumentClient.from(client)
  return _docClient
}

function getMonthKey() {
  return new Date().toISOString().slice(0, 7) // "2026-02"
}

/**
 * Get the current API call count for this month.
 */
export async function getCallCount() {
  const monthKey = getMonthKey()
  const res = await getDocClient().send(new GetCommand({
    TableName: TABLE,
    Key: { userId: '_BUDGET_', itemId: monthKey },
  }))
  return res.Item?.callCount || 0
}

/**
 * Atomically increment the monthly call counter.
 * Uses DynamoDB ADD for safe concurrent Lambda access.
 */
export async function incrementCallCount(count = 1) {
  const monthKey = getMonthKey()
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId: '_BUDGET_', itemId: monthKey },
    UpdateExpression: 'ADD callCount :inc SET updatedAt = :now',
    ExpressionAttributeValues: {
      ':inc': count,
      ':now': new Date().toISOString(),
    },
  }))
}

/**
 * Reset the monthly call counter to 0 (superadmin override).
 * Returns the month key that was reset.
 */
export async function resetCallCount() {
  const monthKey = getMonthKey()
  await getDocClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      userId: '_BUDGET_',
      itemId: monthKey,
      callCount: 0,
      updatedAt: new Date().toISOString(),
      resetAt: new Date().toISOString(),
    },
  }))
  return monthKey
}

/**
 * Check whether the budget allows more API calls.
 * Returns { allowed, used, limit, remaining, budgetDollars }.
 */
export async function checkBudget(callsNeeded = 1) {
  const used = await getCallCount()
  const remaining = Math.max(0, MAX_MONTHLY_CALLS - used)
  return {
    allowed: remaining >= callsNeeded,
    used,
    limit: MAX_MONTHLY_CALLS,
    remaining,
    budgetDollars: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
    month: getMonthKey(),
  }
}

/**
 * Get the last sync timestamp for an item (for cooldown enforcement).
 */
export async function getLastSyncTime(itemId) {
  const res = await getDocClient().send(new GetCommand({
    TableName: TABLE,
    Key: { userId: '_SYNC_COOLDOWN_', itemId },
  }))
  return res.Item?.lastSyncAt || 0
}

/**
 * Record the current time as the last sync for an item.
 */
export async function recordSyncTime(itemId) {
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId: '_SYNC_COOLDOWN_', itemId },
    UpdateExpression: 'SET lastSyncAt = :now',
    ExpressionAttributeValues: { ':now': Date.now() },
  }))
}

/**
 * Check cooldown for an item. Returns { allowed, waitMs }.
 */
export async function checkCooldown(itemId) {
  const lastSync = await getLastSyncTime(itemId)
  const elapsed = Date.now() - lastSync
  if (elapsed < SYNC_COOLDOWN_MS) {
    return { allowed: false, waitMs: SYNC_COOLDOWN_MS - elapsed }
  }
  return { allowed: true, waitMs: 0 }
}

/**
 * Custom error class for budget exceeded.
 */
export class PlaidBudgetExceededError extends Error {
  constructor(budgetStatus) {
    super(
      `Plaid API monthly budget exceeded: ${budgetStatus.used}/${budgetStatus.limit} calls used ` +
      `($${budgetStatus.budgetDollars}/month budget). Resets next month.`
    )
    this.name = 'PlaidBudgetExceededError'
    this.budgetStatus = budgetStatus
  }
}

/**
 * Custom error class for sync cooldown.
 */
export class PlaidSyncCooldownError extends Error {
  constructor(waitMs) {
    const waitSec = Math.ceil(waitMs / 1000)
    super(`Sync cooldown active. Please wait ${waitSec} seconds before syncing again.`)
    this.name = 'PlaidSyncCooldownError'
    this.waitMs = waitMs
  }
}
