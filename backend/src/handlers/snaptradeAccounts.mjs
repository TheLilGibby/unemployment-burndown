import { isSnapTradeConfigured } from '../lib/snaptrade.mjs'
import { requireOrg } from '../lib/auth.mjs'
import { ok, err } from '../lib/response.mjs'
import { createRequestLogger } from '../lib/logger.mjs'

// S3 helpers — reuse from s3.mjs pattern
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.S3_BUCKET || 'rag-consulting-burndown'
const REGION = process.env.S3_REGION || 'us-west-1'

let _s3 = null
function getS3() {
  if (_s3) return _s3
  _s3 = new S3Client({ region: REGION })
  return _s3
}

async function readSnapTradeCache(orgId) {
  const key = orgId ? `orgs/${orgId}/snaptrade-accounts-cache.json` : 'snaptrade-accounts-cache.json'
  try {
    const res = await getS3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const body = await res.Body.transformToString('utf-8')
    return JSON.parse(body)
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null
    throw e
  }
}

/**
 * GET /api/snaptrade/accounts
 *
 * Lists connected investment/brokerage accounts from the S3 cache.
 * Does NOT call SnapTrade API — data is populated by sync and callback handlers.
 */
export async function handler(event) {
  try {
    const { user, error: authErr } = requireOrg(event)
    if (authErr) return err(authErr.statusCode, authErr.message)

    if (!isSnapTradeConfigured()) {
      return ok({ accounts: [], configured: false })
    }

    const cache = await readSnapTradeCache(user.orgId)
    if (cache) {
      return ok({ accounts: cache.accounts || [], cachedAt: cache.cachedAt, fromCache: true })
    }

    return ok({ accounts: [], fromCache: false })
  } catch (error) {
    const log = createRequestLogger('snaptradeAccounts', event)
    log.error({ err: error }, 'SnapTrade accounts fetch failed')
    return err(500, 'An internal error occurred')
  }
}
