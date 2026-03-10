import { useMemo, useCallback } from 'react'

/**
 * Encapsulates transaction-link and transaction-override state + handlers.
 *
 * @param {object}   transactionLinks      current links state
 * @param {function} setTransactionLinks    raw setter
 * @param {object}   transactionOverrides   current overrides state
 * @param {function} setTransactionOverrides raw setter
 * @param {object}   dirtySections          ref to dirty-sections Set
 * @param {function} setHasDirtyChanges     setter for unsaved-changes flag
 */
export function useTransactionLinks({
  transactionLinks,
  setTransactionLinks,
  transactionOverrides: _transactionOverrides,
  setTransactionOverrides,
  dirtySections,
  setHasDirtyChanges,
}) {
  // Reverse-map: transactionId → overviewKey
  const txnToOverviewMap = useMemo(() => {
    const map = {}
    for (const [overviewKey, links] of Object.entries(transactionLinks)) {
      for (const link of links) {
        map[link.transactionId] = overviewKey
      }
    }
    return map
  }, [transactionLinks])

  const handleLinkTransaction = useCallback((overviewKey, txnSnapshot) => {
    // Enforce: each transaction links to at most one overview item
    if (txnToOverviewMap[txnSnapshot.id || txnSnapshot.transactionId]) return
    setTransactionLinks(prev => ({
      ...prev,
      [overviewKey]: [
        ...(prev[overviewKey] || []),
        {
          transactionId: txnSnapshot.id || txnSnapshot.transactionId,
          linkedAt: new Date().toISOString(),
          amount: txnSnapshot.amount,
          date: txnSnapshot.date,
          merchantName: txnSnapshot.merchantName,
          description: txnSnapshot.description,
        }
      ]
    }))
    dirtySections.current.add('Transaction links')
    setHasDirtyChanges(true)
  }, [txnToOverviewMap, setTransactionLinks, dirtySections, setHasDirtyChanges])

  const handleUnlinkTransaction = useCallback((overviewKey, transactionId) => {
    setTransactionLinks(prev => {
      const updated = { ...prev }
      updated[overviewKey] = (updated[overviewKey] || []).filter(l => l.transactionId !== transactionId)
      if (updated[overviewKey].length === 0) delete updated[overviewKey]
      return updated
    })
    dirtySections.current.add('Transaction links')
    setHasDirtyChanges(true)
  }, [setTransactionLinks, dirtySections, setHasDirtyChanges])

  const handleTransactionOverride = useCallback((txnId, updates) => {
    setTransactionOverrides(prev => ({
      ...prev,
      [txnId]: { ...(prev[txnId] || {}), ...updates },
    }))
    dirtySections.current.add('Transaction overrides')
    setHasDirtyChanges(true)
  }, [setTransactionOverrides, dirtySections, setHasDirtyChanges])

  return {
    txnToOverviewMap,
    handleLinkTransaction,
    handleUnlinkTransaction,
    handleTransactionOverride,
  }
}
