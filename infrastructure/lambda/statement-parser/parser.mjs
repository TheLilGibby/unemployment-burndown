import pino from 'pino'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { getS3Object } from './s3Helpers.mjs'

const log = pino({ name: 'statement-parser' })

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-1' })
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-haiku-4-5-20251001-v1:0'

// Two-tier subcategory keys — keep in sync with src/constants/categories.js
const CATEGORIES = [
  'dining_general', 'dining_coffee', 'dining_fastFood', 'dining_bars',
  'groceries_general', 'groceries_delivery', 'groceries_alcohol',
  'gas_general', 'gas_ev',
  'travel_general', 'travel_flights', 'travel_lodging', 'travel_rentalCars',
  'entertainment_general', 'entertainment_events', 'entertainment_gaming',
  'shopping_general', 'shopping_online', 'shopping_clothing', 'shopping_electronics',
  'subscriptions_general', 'subscriptions_streaming', 'subscriptions_software',
  'health_general', 'health_dental', 'health_vision', 'health_pharmacy', 'health_fitness', 'health_veterinary',
  'utilities_general', 'utilities_electric', 'utilities_internet', 'utilities_phone', 'utilities_water',
  'transportation_general', 'transportation_rideshare', 'transportation_publicTransit', 'transportation_parking',
  'education_general', 'education_tuition', 'education_books',
  'personalCare_general', 'personalCare_hairBeauty', 'personalCare_laundry',
  'fees_general', 'fees_bankFees', 'fees_interest', 'fees_lateFees',
  'homeImprovement_general', 'homeImprovement_furniture', 'homeImprovement_hardware', 'homeImprovement_contractors',
  'investments_general', 'investments_crypto', 'investments_retirement', 'investments_stocks',
  'venmo_general', 'venmo_rent', 'venmo_bills', 'venmo_personal',
  'payroll_general', 'payroll_wages', 'payroll_dividends',
  'mortgage_general', 'rent_general', 'transfer_general',
  'other_general', 'other_government', 'other_charity',
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

Categories use a two-tier system: parentCategory_subCategory. Pick the most specific subcategory that fits. Use _general when no specific subcategory applies.

Category guidelines:
- dining_general: restaurants, takeout, food delivery
- dining_coffee: coffee shops, cafes (Starbucks, Dunkin, etc.)
- dining_fastFood: fast food chains and quick-service restaurants
- dining_bars: bars, pubs, nightclubs
- groceries_general: supermarkets, grocery stores
- groceries_delivery: grocery delivery (Instacart, Amazon Fresh)
- groceries_alcohol: liquor stores, wine shops, beer/wine/spirits from stores
- gas_general: gas stations, fuel
- gas_ev: EV charging stations
- travel_general: travel agencies, booking services
- travel_flights: airlines, air travel
- travel_lodging: hotels, motels, Airbnb, lodging
- travel_rentalCars: car rentals
- entertainment_general: general entertainment and recreation
- entertainment_events: concerts, sporting events, museums, amusement parks
- entertainment_gaming: video games, gaming subscriptions and hardware
- shopping_general: retail, department stores, miscellaneous shopping
- shopping_online: Amazon, eBay, online marketplaces
- shopping_clothing: clothing, shoes, jewelry, fashion accessories
- shopping_electronics: electronics, computers, phones, tech accessories
- subscriptions_general: general recurring subscriptions and memberships
- subscriptions_streaming: Netflix, Spotify, streaming services
- subscriptions_software: software subscriptions, SaaS, cloud services
- health_general: doctor visits, general medical expenses
- health_dental: dentists, orthodontists
- health_vision: optometrists, glasses, contacts
- health_pharmacy: pharmacies, prescriptions, medications
- health_fitness: gyms, fitness centers, personal training
- health_veterinary: veterinary services, pet healthcare
- utilities_general: general utility bills
- utilities_electric: electric and natural gas bills
- utilities_internet: internet, cable, broadband
- utilities_phone: cell phone, telephone service
- utilities_water: water, sewer, waste management
- transportation_general: general transportation
- transportation_rideshare: Uber, Lyft, taxis
- transportation_publicTransit: bus, subway, train
- transportation_parking: parking fees, tolls
- education_general: general educational expenses, courses
- education_tuition: tuition, school fees
- education_books: textbooks, school supplies, bookstores
- personalCare_general: general personal care
- personalCare_hairBeauty: salons, barbers, spas, beauty
- personalCare_laundry: laundromats, dry cleaners
- fees_general: general fees
- fees_bankFees: ATM fees, overdraft fees, account fees
- fees_interest: credit card interest, finance charges
- fees_lateFees: late payment penalties
- homeImprovement_general: general home improvement
- homeImprovement_furniture: furniture, home decor
- homeImprovement_hardware: hardware stores, tools, building materials
- homeImprovement_contractors: contractors, renovation services
- investments_general: general investment transactions
- investments_crypto: cryptocurrency (Coinbase, Binance, etc.)
- investments_retirement: 401k, IRA, pension contributions
- investments_stocks: stocks, ETFs, brokerage (Fidelity, Schwab, etc.)
- venmo_general: general Venmo, Zelle, CashApp, P2P transfers
- venmo_rent: rent or mortgage via P2P
- venmo_bills: bill payments via P2P
- venmo_personal: personal transfers, splitting costs, gifts via P2P
- payroll_general: general payroll and income
- payroll_wages: wages, salary, hourly pay
- payroll_dividends: dividends, interest income
- mortgage_general: mortgage payments
- rent_general: rent payments
- transfer_general: internal account transfers
- other_general: anything that doesn't fit above
- other_government: tax payments, government fees
- other_charity: donations, charitable contributions

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
      category: CATEGORIES.includes(txn.category) ? txn.category : 'other_general',
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
