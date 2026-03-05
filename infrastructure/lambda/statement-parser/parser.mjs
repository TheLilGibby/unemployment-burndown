import pino from 'pino'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { getS3Object } from './s3Helpers.mjs'

const log = pino({ name: 'statement-parser' })

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-1' })
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-haiku-4-5-20251001-v1:0'

const CATEGORIES = [
  'dining', 'groceries', 'gas', 'travel', 'entertainment', 'shopping',
  'subscriptions', 'health', 'utilities', 'transportation', 'education',
  'personalCare', 'fees', 'homeImprovement', 'investments',
  'investments_crypto', 'investments_retirement', 'investments_stocks',
  'payroll', 'mortgage', 'rent', 'transfer', 'other',
]

const SYSTEM_PROMPT = `You are a credit card statement parser. Given the raw text of a credit card statement (from an email body or PDF), extract structured data.

Return ONLY valid JSON with this exact schema — no markdown, no explanation:

{
  "issuer": "string — card issuer name (e.g. Chase, Amex, Capital One)",
  "cardLastFour": "string — last 4 digits of card number if visible, else null",
  "statementPeriodStart": "YYYY-MM-DD or null",
  "statementPeriodEnd": "YYYY-MM-DD or null",
  "closingDate": "YYYY-MM-DD or null",
  "paymentDueDate": "YYYY-MM-DD or null",
  "statementBalance": number,
  "minimumPaymentDue": number or null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "original transaction description",
      "merchantName": "cleaned merchant name",
      "category": "one of: ${CATEGORIES.join(', ')}",
      "amount": number (positive for charges, negative for credits/refunds),
      "isRefund": boolean
    }
  ],
  "parsingConfidence": number between 0 and 1
}

Category guidelines:
- dining: restaurants, cafes, coffee shops, fast food, bars
- groceries: supermarkets, grocery stores, food delivery (groceries)
- gas: gas stations, fuel
- travel: airlines, hotels, car rentals, booking sites
- entertainment: streaming, movies, concerts, games, sports
- shopping: retail, online shopping, Amazon, department stores
- subscriptions: recurring services, memberships, software subscriptions
- health: pharmacy, doctor, dentist, gym, medical
- utilities: electric, water, internet, phone, cable
- transportation: rideshare, public transit, parking, tolls
- education: tuition, books, courses, school supplies
- personalCare: salon, spa, cosmetics, clothing care
- fees: late fees, annual fees, interest charges, finance charges
- homeImprovement: home improvement stores, furniture, hardware, contractors, renovations
- investments: general investment transactions
- investments_crypto: cryptocurrency purchases, exchanges (Coinbase, Binance, etc.)
- investments_retirement: 401k, IRA, pension contributions
- investments_stocks: stock/ETF purchases, brokerage transactions (Fidelity, Schwab, etc.)
- payroll: wages, salary, direct deposits, income
- mortgage: mortgage payments
- rent: rent payments (including via Venmo/Zelle/P2P)
- transfer: internal account transfers, Venmo, Zelle, CashApp, or other P2P transfers
- other: anything that doesn't fit above

Important:
- Amounts should be numbers (not strings). Charges are positive, refunds/credits are negative.
- Parse ALL transactions visible in the statement.
- If you cannot determine a field, use null.
- statementBalance should be the total new balance / amount due.`

/**
 * Call Bedrock Claude to parse statement text into structured JSON.
 */
export async function parseStatementWithBedrock(textContent, senderInfo) {
  const userMessage = `Parse this credit card statement. Sender: ${senderInfo}\n\n---\n${textContent.slice(0, 30000)}`

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const res = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  }))

  const output = JSON.parse(new TextDecoder().decode(res.body))
  const text = output.content?.[0]?.text || ''

  // Extract JSON from the response (handle possible markdown wrapping)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Bedrock response did not contain valid JSON')
  }

  const parsed = JSON.parse(jsonMatch[0])

  // Validate categories
  if (parsed.transactions) {
    parsed.transactions = parsed.transactions.map(txn => ({
      ...txn,
      category: CATEGORIES.includes(txn.category) ? txn.category : 'other',
      amount: Number(txn.amount) || 0,
      isRefund: Boolean(txn.isRefund),
    }))
  }

  return parsed
}

/**
 * Match a parsed statement to an existing credit card from the user's data.json.
 * Matches by issuer name or last-four digits against card names.
 */
export async function matchToCard(bucket, issuer, statementData) {
  try {
    const raw = await getS3Object(bucket, 'data.json')
    const data = JSON.parse(raw.toString('utf-8'))
    const cards = data.creditCards || []

    if (!cards.length) return null

    const issuerLower = (issuer || '').toLowerCase()
    const lastFour = statementData.cardLastFour || ''

    // Try exact last-four match in card name
    if (lastFour) {
      const match = cards.find(c =>
        (c.name || '').includes(lastFour)
      )
      if (match) return match.id
    }

    // Try issuer name match
    if (issuerLower) {
      const match = cards.find(c => {
        const name = (c.name || '').toLowerCase()
        return name.includes(issuerLower) || issuerLower.includes(name.split(' ')[0])
      })
      if (match) return match.id
    }

    // No match — return null (unmatched statements still get stored)
    log.warn({ issuer, lastFour }, 'could not match issuer to any card')
    return null
  } catch (err) {
    log.warn({ err }, 'failed to read data.json for card matching')
    return null
  }
}
