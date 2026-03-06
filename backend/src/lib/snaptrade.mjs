import Snaptrade from 'snaptrade-typescript-sdk'
import { checkBudget, incrementCallCount, SnapTradeBudgetExceededError } from './snaptradeBudget.mjs'

let _client = null

/**
 * Returns a budget-guarded SnapTrade client.
 *
 * The SnapTrade SDK uses namespaced methods (e.g. client.authentication.registerSnapTradeUser).
 * The Proxy wraps each namespace object so that every async method call:
 *   1. Checks the monthly API call budget BEFORE the call
 *   2. Increments the counter AFTER a successful call
 *   3. Throws SnapTradeBudgetExceededError if the budget is exhausted
 */
export function getSnapTradeClient() {
  if (_client) return _client

  const rawClient = new Snaptrade({
    consumerKey: process.env.SNAPTRADE_API_SECRET,
    clientId: process.env.SNAPTRADE_CLIENT_ID,
  })

  _client = createGuardedClient(rawClient)
  return _client
}

function createGuardedClient(client) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)

      // Wrap namespace objects (authentication, connections, accountInformation, etc.)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return new Proxy(value, {
          get(nsTarget, nsProp, nsReceiver) {
            const nsValue = Reflect.get(nsTarget, nsProp, nsReceiver)
            if (typeof nsValue !== 'function') return nsValue

            return async function guardedCall(...args) {
              const budget = await checkBudget()
              if (!budget.allowed) {
                throw new SnapTradeBudgetExceededError(budget)
              }

              const result = await nsValue.apply(nsTarget, args)

              await incrementCallCount()

              return result
            }
          },
        })
      }

      return value
    },
  })
}
