/**
 * Maps Plaid's personal_finance_category to the app's statement categories.
 *
 * Plaid categories: https://plaid.com/docs/api/products/transactions/#transactionssync
 * App categories:   src/constants/categories.js
 *
 * Detailed overrides take priority over primary mapping so that e.g.
 * FOOD_AND_DRINK_GROCERIES → 'groceries' rather than the generic 'dining'.
 */

const PRIMARY_MAP = {
  FOOD_AND_DRINK:             'dining',
  GENERAL_MERCHANDISE:        'shopping',
  GENERAL_SERVICES:           'other',
  GOVERNMENT_AND_NON_PROFIT:  'other',
  HOME_IMPROVEMENT:           'homeImprovement',
  INCOME:                     'other',
  LOAN_PAYMENTS:              'fees',
  MEDICAL:                    'health',
  PERSONAL_CARE:              'personalCare',
  RENT_AND_UTILITIES:         'utilities',
  TRANSFER_IN:                'venmo',
  TRANSFER_OUT:               'venmo',
  TRANSPORTATION:             'transportation',
  TRAVEL:                     'travel',
  BANK_FEES:                  'fees',
  ENTERTAINMENT:              'entertainment',
  RECREATION:                 'entertainment',
  INVESTMENTS:                'investments',
}

const DETAILED_OVERRIDES = {
  FOOD_AND_DRINK_GROCERIES:                'groceries',
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR:     'groceries',
  FOOD_AND_DRINK_COFFEE:                   'dining',
  FOOD_AND_DRINK_FAST_FOOD:                'dining',
  FOOD_AND_DRINK_RESTAURANT:               'dining',
  FOOD_AND_DRINK_VENDING_MACHINES:         'dining',
  TRANSPORTATION_GAS:                      'gas',
  TRANSPORTATION_FUEL:                     'gas',
  TRANSPORTATION_PARKING:                  'transportation',
  TRANSPORTATION_PUBLIC_TRANSIT:            'transportation',
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES:    'transportation',
  ENTERTAINMENT_MUSIC_AND_AUDIO:           'subscriptions',
  ENTERTAINMENT_TV_AND_MOVIES:             'subscriptions',
  ENTERTAINMENT_VIDEO_GAMES:               'entertainment',
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: 'entertainment',
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: 'shopping',
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'shopping',
  GENERAL_MERCHANDISE_ELECTRONICS:         'shopping',
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: 'education',
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY:  'utilities',
  RENT_AND_UTILITIES_INTERNET_AND_CABLE:   'utilities',
  RENT_AND_UTILITIES_TELEPHONE:            'utilities',
  RENT_AND_UTILITIES_WATER:                'utilities',
  RENT_AND_UTILITIES_RENT:                 'utilities',
  MEDICAL_DENTISTS_AND_ORTHODONTISTS:      'health',
  MEDICAL_EYE_CARE:                        'health',
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS:      'health',
  MEDICAL_VETERINARY_SERVICES:             'health',
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS:  'health',
  PERSONAL_CARE_HAIR_AND_BEAUTY:           'personalCare',
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING:  'personalCare',
  TRAVEL_FLIGHTS:                          'travel',
  TRAVEL_LODGING:                          'travel',
  TRAVEL_RENTAL_CARS:                      'travel',
  INVESTMENTS_BROKERAGE:                   'investments_stocks',
  INVESTMENTS_RETIREMENT:                  'investments_retirement',
  INVESTMENTS_CRYPTO:                      'investments_crypto',
  HOME_IMPROVEMENT_FURNITURE:              'homeImprovement',
  HOME_IMPROVEMENT_HARDWARE:               'homeImprovement',
  TRANSFER_IN_ACCOUNT_TRANSFER:            'transfer',
  TRANSFER_OUT_ACCOUNT_TRANSFER:           'transfer',
  TRANSFER_IN_THIRD_PARTY:                 'venmo',
  TRANSFER_OUT_THIRD_PARTY:                'venmo',
}

/**
 * Map a Plaid personal_finance_category object to one of the app's 14 category keys.
 *
 * @param {object|null} personalFinanceCategory  - { primary: string, detailed: string }
 * @returns {string} One of the app category keys (e.g. 'dining', 'groceries', 'investments_crypto', etc.)
 */
export function mapPlaidCategory(personalFinanceCategory) {
  if (!personalFinanceCategory) return 'other'
  const { primary, detailed } = personalFinanceCategory
  if (detailed && DETAILED_OVERRIDES[detailed]) return DETAILED_OVERRIDES[detailed]
  if (primary && PRIMARY_MAP[primary]) return PRIMARY_MAP[primary]
  return 'other'
}
