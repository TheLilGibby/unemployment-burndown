import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.TOKENS_TABLE || 'PlaidTokens'

// ── Budget configuration (env-var defaults, overridable via DynamoDB) ──
const DEFAULT_MONTHLY_BUDGET = parseFloat(process.env.SNAPTRADE_MONTHLY_BUDGET || '15')
const DEFAULT_EST_COST_PER_CALL = parseFloat(process.env.SNAPTRADE_EST_COST_PER_CALL || '0.50')
const DEFAULT_MAX_SYNC_PAGES = parseInt(process.env.SNAPTRADE_MAX_SYNC_PAGES || '10', 10)
const DEFAULT_SYNC_COOLDOWN_SECONDS = parseInt(process.env.SNAPTRADE_SYNC_COOLDOWN_SECONDS || '300', 10)

// Exported mutable values – updated by getLimits()
export let MONTHLY_BUDGET = DEFAULT_MONTHLY_BUDGET
export let EST_COST_PER_CALL = DEFAULT_EST_COST_PER_CALL
export let MAX_MONTHLY_CALLS = Math.floor(MONTHLY_BUDGET / EST_COST_PER_CALL)
export let MAX_SYNC_PAGES = DEFAULT_MAX_SYNC_PAGES
export let SYNC_COOLDOWN_MS = DEFAULT_SYNC_COOLDOWN_SECONDS * 1000

// DynamoDB key for persisted limit overrides
const LIMITS_KEY = { userId: '_SNAPTRADE_LIMITS_', itemId: 'config' }

/**
 * Load limits from DynamoDB (superadmin overrides), falling back to env-var defaults.
 */
export async function getLimits() {
  try {
    const res = await getDocClient().send(new GetCommand({
      TableName: TABLE,
      Key: LIMITS_KEY,
    }))
    const item = res.Item || {}
    MONTHLY_BUDGET = item.monthlyBudget ?? DEFAULT_MONTHLY_BUDGET
    EST_COST_PER_CALL = item.estCostPerCall ?? DEFAULT_EST_COST_PER_CALL
    MAX_SYNC_PAGES = item.maxSyncPages ?? DEFAULT_MAX_SYNC_PAGES
    const cooldownSec = item.syncCooldownSeconds ?? DEFAULT_SYNC_COOLDOWN_SECONDS
    SYNC_COOLDOWN_MS = cooldownSec * 1000
    MAX_MONTHLY_CALLS = Math.floor(MONTHLY_BUDGET / EST_COST_PER_CALL)
  } catch {
    MONTHLY_BUDGET = DEFAULT_MONTHLY_BUDGET
    EST_COST_PER_CALL = DEFAULT_EST_COST_PER_CALL
    MAX_SYNC_PAGES = DEFAULT_MAX_SYNC_PAGES
    SYNC_COOLDOWN_MS = DEFAULT_SYNC_COOLDOWN_SECONDS * 1000
    MAX_MONTHLY_CALLS = Math.floor(MONTHLY_BUDGET / EST_COST_PER_CALL)
  }
  return {
    monthlyBudget: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
    maxSyncPages: MAX_SYNC_PAGES,
    syncCooldownSeconds: SYNC_COOLDOWN_MS / 1000,
    maxMonthlyCalls: MAX_MONTHLY_CALLS,
  }
}

/**
 * Persist new limit overrides to DynamoDB (superadmin only).
 */
export async function setLimits({ monthlyBudget, estCostPerCall, maxSyncPages, syncCooldownSeconds }) {
  const current = await getLimits()
  const updated = {
    monthlyBudget: monthlyBudget ?? current.monthlyBudget,
    estCostPerCall: estCostPerCall ?? current.estCostPerCall,
    maxSyncPages: maxSyncPages ?? current.maxSyncPages,
    syncCooldownSeconds: syncCooldownSeconds ?? current.syncCooldownSeconds,
  }
  await getDocClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      ...LIMITS_KEY,
      ...updated,
      updatedAt: new Date().toISOString(),
    },
  }))
  return getLimits()
}

// ── DynamoDB client ──
let _docClient = null

function getDocClient() {
  if (_docClient) return _docClient
  const client = new DynamoDBClient({})
  _docClient = DynamoDBDocumentClient.from(client)
  return _docClient
}

function getMonthKey() {
  return new Date().toISOString().slice(0, 7)
}

export async function getCallCount() {
  const monthKey = getMonthKey()
  const res = await getDocClient().send(new GetCommand({
    TableName: TABLE,
    Key: { userId: '_SNAPTRADE_BUDGET_', itemId: monthKey },
  }))
  return res.Item?.callCount || 0
}

export async function incrementCallCount(count = 1) {
  const monthKey = getMonthKey()
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId: '_SNAPTRADE_BUDGET_', itemId: monthKey },
    UpdateExpression: 'ADD callCount :inc SET updatedAt = :now',
    ExpressionAttributeValues: {
      ':inc': count,
      ':now': new Date().toISOString(),
    },
  }))
}

export async function resetCallCount() {
  const monthKey = getMonthKey()
  await getDocClient().send(new PutCommand({
    TableName: TABLE,
    Item: {
      userId: '_SNAPTRADE_BUDGET_',
      itemId: monthKey,
      callCount: 0,
      updatedAt: new Date().toISOString(),
      resetAt: new Date().toISOString(),
    },
  }))
  return monthKey
}

export async function checkBudget(callsNeeded = 1) {
  await getLimits()
  const used = await getCallCount()
  const remaining = Math.max(0, MAX_MONTHLY_CALLS - used)
  return {
    allowed: remaining >= callsNeeded,
    used,
    limit: MAX_MONTHLY_CALLS,
    remaining,
    budgetDollars: MONTHLY_BUDGET,
    estCostPerCall: EST_COST_PER_CALL,
    maxSyncPages: MAX_SYNC_PAGES,
    syncCooldownSeconds: SYNC_COOLDOWN_MS / 1000,
    month: getMonthKey(),
  }
}

export async function getLastSyncTime(connectionId) {
  const res = await getDocClient().send(new GetCommand({
    TableName: TABLE,
    Key: { userId: '_SNAPTRADE_SYNC_COOLDOWN_', itemId: connectionId },
  }))
  return res.Item?.lastSyncAt || 0
}

export async function recordSyncTime(connectionId) {
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId: '_SNAPTRADE_SYNC_COOLDOWN_', itemId: connectionId },
    UpdateExpression: 'SET lastSyncAt = :now',
    ExpressionAttributeValues: { ':now': Date.now() },
  }))
}

export async function checkCooldown(connectionId) {
  const lastSync = await getLastSyncTime(connectionId)
  const elapsed = Date.now() - lastSync
  if (elapsed < SYNC_COOLDOWN_MS) {
    return { allowed: false, waitMs: SYNC_COOLDOWN_MS - elapsed }
  }
  return { allowed: true, waitMs: 0 }
}

export class SnapTradeBudgetExceededError extends Error {
  constructor(budgetStatus) {
    super(
      `SnapTrade API monthly budget exceeded: ${budgetStatus.used}/${budgetStatus.limit} calls used ` +
      `($${budgetStatus.budgetDollars}/month budget). Resets next month.`
    )
    this.name = 'SnapTradeBudgetExceededError'
    this.budgetStatus = budgetStatus
  }
}

export class SnapTradeSyncCooldownError extends Error {
  constructor(waitMs) {
    const waitSec = Math.ceil(waitMs / 1000)
    super(`Sync cooldown active. Please wait ${waitSec} seconds before syncing again.`)
    this.name = 'SnapTradeSyncCooldownError'
    this.waitMs = waitMs
  }
}
