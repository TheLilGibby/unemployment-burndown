/**
 * Compute the effective monthly payment for a credit card based on its payment strategy.
 *
 * @param {object} card - Credit card object with balance, minimumPayment, paymentStrategy, paymentAmount
 * @returns {number} The effective monthly payment amount
 */
export function getEffectivePayment(card) {
  const min = Number(card.minimumPayment) || 0
  if (card.paymentStrategy === 'full') return Number(card.balance) || 0
  if (card.paymentStrategy === 'fixed') return Number(card.paymentAmount) || min
  return min // default: 'minimum' or undefined
}
