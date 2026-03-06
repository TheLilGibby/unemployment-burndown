import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.TOKENS_TABLE || 'PlaidTokens'

// ── Budget configuration ──
export const MONTHLY_BUDGET = parseFloat(process.env.SNAPTRADE_MONTHLY_BUDGET || '10')
export const EST_COST_PER_CALL = parseFloat(process.env.SNAPTRADE_EST_COST_PER_CALL || '0.01')
export const MAX_MONTHLY_CALLS = Math.floor(MONTHLY_BUDGET / EST_COST_PER_CALL)
export const SYNC_COOLDOWN_MS = parseInt(process.env.SNAPTRADE_SYNC_COOLDOWN_SECONDS || '300', 10) * 1000

// ── DynamoDB client (reuse across invocations) ──
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
    Key: { userId: '_ST_BUDGET_', itemId: monthKey },
  }))
  return res.Item?.callCount || 0
}

export async function incrementCallCount(count = 1) {
  const monthKey = getMonthKey()
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId: '_ST_BUDGET_', itemId: monthKey },
    UpdateExpression: 'ADD callCount :inc SET updatedAt = :now',
    ExpressionAttributeValues: {
      ':inc': count,
      ':now': new Date().toISOString(),
    },
  }))
}

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

export async function getLastSyncTime(itemId) {
  const res = await getDocClient().send(new GetCommand({
    TableName: TABLE,
    Key: { userId: '_ST_SYNC_COOLDOWN_', itemId },
  }))
  return res.Item?.lastSyncAt || 0
}

export async function recordSyncTime(itemId) {
  await getDocClient().send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId: '_ST_SYNC_COOLDOWN_', itemId },
    UpdateExpression: 'SET lastSyncAt = :now',
    ExpressionAttributeValues: { ':now': Date.now() },
  }))
}

export async function checkCooldown(itemId) {
  const lastSync = await getLastSyncTime(itemId)
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
