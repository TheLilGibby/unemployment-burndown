import crypto from 'node:crypto'
import { checkBudget, incrementCallCount, SnapTradeBudgetExceededError } from './snaptradeBudget.mjs'

const BASE_URL = 'https://api.snaptrade.com/api/v1'

/**
 * Returns a budget-guarded SnapTrade API wrapper.
 *
 * SnapTrade uses clientId + consumerKey authentication with HMAC signatures.
 * Every API call is budget-checked before execution and counted after success,
 * following the same pattern as the Plaid budget guard.
 */
export function getSnapTradeClient() {
  const clientId = process.env.SNAPTRADE_CLIENT_ID
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY

  if (!clientId || !consumerKey) {
    throw new Error('SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY are required')
  }

  return createGuardedClient({ clientId, consumerKey })
}

/**
 * Check if SnapTrade credentials are configured.
 */
export function isSnapTradeConfigured() {
  return !!(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY)
}

// ── Raw API helpers ──

function generateSignature(consumerKey, requestData) {
  const content = JSON.stringify(requestData)
  return crypto.createHmac('sha256', consumerKey).update(content).digest('hex')
}

async function snapTradeRequest({ clientId, consumerKey }, method, path, body = null, query = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })

  const timestamp = Math.floor(Date.now() / 1000)
  const sigData = { clientId, timestamp }
  const signature = generateSignature(consumerKey, sigData)

  const headers = {
    'Content-Type': 'application/json',
    'clientId': clientId,
    'Signature': signature,
    'Timestamp': String(timestamp),
  }

  const options = { method, headers }
  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body)
  }

  const res = await fetch(url.toString(), options)
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`SnapTrade API error: unexpected response (HTTP ${res.status})`)
  }
  if (!res.ok) {
    throw new Error(data.detail?.message || data.message || `SnapTrade API error (HTTP ${res.status})`)
  }
  return data
}

// ── Budget-guarded client ──

function createGuardedClient(creds) {
  const client = {
    /**
     * Register an org as a SnapTrade user. Idempotent — returns existing user if already registered.
     */
    async registerUser(orgId) {
      return snapTradeRequest(creds, 'POST', '/snapTrade/registerUser', {
        userId: orgId,
      })
    },

    /**
     * Delete a SnapTrade user registration.
     */
    async deleteUser(orgId) {
      return snapTradeRequest(creds, 'DELETE', `/snapTrade/deleteUser`, null, { userId: orgId })
    },

    /**
     * Generate a redirect URL for the user to connect a brokerage.
     * @param {string} orgId - The org identifier (SnapTrade userId)
     * @param {string} userSecret - The user's SnapTrade secret
     * @param {string} [broker] - Optional broker slug (e.g., 'FIDELITY')
     * @param {string} [callbackUrl] - Redirect URL after connection
     */
    async getLoginLink(orgId, userSecret, { broker, callbackUrl } = {}) {
      const body = {
        userId: orgId,
        userSecret,
        broker: broker || undefined,
        immediateRedirect: true,
        customRedirect: callbackUrl || undefined,
        reconnect: undefined,
      }
      return snapTradeRequest(creds, 'POST', '/snapTrade/login', body)
    },

    /**
     * List all brokerage connections for an org.
     */
    async listConnections(orgId, userSecret) {
      return snapTradeRequest(creds, 'GET', '/authorizations', null, {
        userId: orgId,
        userSecret,
      })
    },

    /**
     * Get holdings/positions for a specific connection.
     */
    async getHoldings(orgId, userSecret, connectionId) {
      return snapTradeRequest(creds, 'GET', `/holdings`, null, {
        userId: orgId,
        userSecret,
        accountId: connectionId,
      })
    },

    /**
     * Get account balances for a connection.
     */
    async getAccountBalances(orgId, userSecret, accountId) {
      return snapTradeRequest(creds, 'GET', `/accounts/${accountId}/balances`, null, {
        userId: orgId,
        userSecret,
      })
    },

    /**
     * List all accounts across all connections.
     */
    async listAccounts(orgId, userSecret) {
      return snapTradeRequest(creds, 'GET', '/accounts', null, {
        userId: orgId,
        userSecret,
      })
    },

    /**
     * Get transaction activity for an account.
     */
    async getActivities(orgId, userSecret, { accountId, startDate, endDate } = {}) {
      return snapTradeRequest(creds, 'GET', '/activities', null, {
        userId: orgId,
        userSecret,
        accountId,
        startDate,
        endDate,
      })
    },

    /**
     * Remove a brokerage connection.
     */
    async deleteConnection(orgId, userSecret, authorizationId) {
      return snapTradeRequest(creds, 'DELETE', `/authorizations/${authorizationId}`, null, {
        userId: orgId,
        userSecret,
      })
    },
  }

  // Wrap every method with budget guard
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

      return async function guardedCall(...args) {
        const budget = await checkBudget()
        if (!budget.allowed) {
          throw new SnapTradeBudgetExceededError(budget)
        }
        const result = await value.apply(target, args)
        await incrementCallCount()
        return result
      }
    },
  })
}
