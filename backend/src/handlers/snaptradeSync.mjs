import { getSnapTradeClient, isSnapTradeConfigured } from '../lib/snaptrade.mjs'
import { checkCooldown, recordSyncTime, SnapTradeSyncCooldownError } from '../lib/snaptradeBudget.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'
import { getPlaidItem } from '../lib/dynamo.mjs'
import { decrypt, isEncryptionConfigured } from '../lib/encryption.mjs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.S3_BUCKET || 'rag-consulting-burndown'
const REGION = process.env.S3_REGION || 'us-west-1'

let _s3 = null
function getS3() {
  if (_s3) return _s3
  _s3 = new S3Client({ region: REGION })
  return _s3
}

async function writeSnapTradeCache(orgId, accounts) {
  const key = orgId ? `orgs/${orgId}/snaptrade-accounts-cache.json` : 'snaptrade-accounts-cache.json'
  await getS3().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify({ cachedAt: new Date().toISOString(), accounts }, null, 2),
    ContentType: 'application/json',
  }))
}

/**
 * POST /api/snaptrade/sync
 *
 * Syncs investment holdings and account balances from SnapTrade.
 * Updates the S3 accounts cache with fresh data.
 *
 * Body: { connectionId?: string }
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (!isSnapTradeConfigured()) {
      return err(503, 'SnapTrade integration is not configured')
    }

    const body = JSON.parse(event.body || '{}')
    const orgId = user.orgId

    // Check cooldown
    const cooldownKey = body.connectionId || orgId
    const cooldown = await checkCooldown(cooldownKey)
    if (!cooldown.allowed) {
      throw new SnapTradeSyncCooldownError(cooldown.waitMs)
    }

    // Retrieve stored userSecret
    const reg = await getPlaidItem(`_SNAPTRADE_USER_${orgId}`, 'registration')
    if (!reg?.accessToken) {
      return err(400, 'Organization not registered with SnapTrade')
    }
    const userSecret = isEncryptionConfigured() ? decrypt(reg.accessToken) : reg.accessToken

    const client = getSnapTradeClient()

    // Fetch all accounts
    const accounts = await client.listAccounts(orgId, userSecret)

    // Fetch holdings for each account
    const enrichedAccounts = []
    for (const account of (accounts || [])) {
      let holdings = []
      let balances = null
      try {
        const holdingsData = await client.getHoldings(orgId, userSecret, account.id || account.accountId)
        holdings = holdingsData?.positions || holdingsData || []
      } catch (e) {
        const log = createRequestLogger('snaptradeSync', event)
        log.warn({ err: e, accountId: account.id }, 'failed to fetch holdings for account')
      }
      try {
        balances = await client.getAccountBalances(orgId, userSecret, account.id || account.accountId)
      } catch (e) {
        // Balances are optional
      }

      enrichedAccounts.push({
        id: account.id || account.accountId,
        name: account.name || account.accountName,
        number: account.number || account.mask,
        type: account.type || 'investment',
        institution: account.institution?.name || account.brokerageName || 'Unknown',
        institutionId: account.institution?.id || account.brokerageId,
        currency: account.currency || 'USD',
        totalValue: balances?.totalValue ?? account.balance?.amount ?? null,
        cashBalance: balances?.cash ?? null,
        holdings: Array.isArray(holdings) ? holdings.map(h => ({
          symbol: h.symbol?.symbol || h.ticker || h.symbol,
          name: h.symbol?.description || h.name || h.symbol,
          quantity: h.units ?? h.quantity ?? 0,
          price: h.price ?? h.currentPrice ?? 0,
          value: h.value ?? (h.units * h.price) ?? 0,
          currency: h.currency || 'USD',
        })) : [],
        lastSync: new Date().toISOString(),
      })
    }

    // Write cache
    await writeSnapTradeCache(orgId, enrichedAccounts)

    // Record sync time for cooldown
    await recordSyncTime(cooldownKey)

    return ok({
      updated: true,
      accounts: enrichedAccounts,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error.name === 'SnapTradeSyncCooldownError') {
      return err(429, error.message)
    }
    if (error.name === 'SnapTradeBudgetExceededError') {
      return err(429, error.message)
    }
    const log = createRequestLogger('snaptradeSync', event)
    log.error({ err: error }, 'SnapTrade sync failed')
    return err(500, 'An internal error occurred')
  }
}
