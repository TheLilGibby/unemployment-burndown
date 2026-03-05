import { useMemo } from 'react'
import { detectTransferPairs, buildPairLookup } from '../utils/transferPairDetector'

/**
 * React hook that detects transfer pairs across loaded statements.
 *
 * @param {Array} statements - Array of statement objects, each with .id, .transactions[]
 * @param {object} opts - Options passed to detectTransferPairs (e.g. { maxDayGap: 2 })
 * @returns {{ pairs: Array, pairLookup: Map, getPair: (txnId) => object|null, isPaired: (txnId) => boolean }}
 */
export function useTransferPairs(statements, opts = {}) {
  const pairs = useMemo(
    () => detectTransferPairs(statements || [], opts),
    [statements, opts.maxDayGap]
  )

  const pairLookup = useMemo(
    () => buildPairLookup(pairs),
    [pairs]
  )

  const getPair = (txnId) => pairLookup.get(txnId) || null
  const isPaired = (txnId) => pairLookup.has(txnId)

  return { pairs, pairLookup, getPair, isPaired }
}
