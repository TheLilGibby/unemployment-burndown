/**
 * Maps Plaid's personal_finance_category to the app's two-tier statement categories.
 *
 * Plaid categories: https://plaid.com/docs/api/products/transactions/#transactionssync
 * App categories:   src/constants/categories.js
 *
 * All values are subcategory keys (format: parentKey_subKey).
 * Detailed overrides take priority over primary mapping so that e.g.
 * FOOD_AND_DRINK_GROCERIES → 'groceries_general' rather than the generic 'dining_general'.
 */

const PRIMARY_MAP = {
  FOOD_AND_DRINK:             'dining_general',
  GENERAL_MERCHANDISE:        'shopping_general',
  GENERAL_SERVICES:           'other_general',
  GOVERNMENT_AND_NON_PROFIT:  'other_government',
  HOME_IMPROVEMENT:           'homeImprovement_general',
  INCOME:                     'payroll_general',
  LOAN_PAYMENTS:              'mortgage_general',
  MEDICAL:                    'health_general',
  PERSONAL_CARE:              'personalCare_general',
  RENT_AND_UTILITIES:         'utilities_general',
  TRANSFER_IN:                'venmo_general',
  TRANSFER_OUT:               'venmo_general',
  TRANSPORTATION:             'transportation_general',
  TRAVEL:                     'travel_general',
  BANK_FEES:                  'fees_bankFees',
  ENTERTAINMENT:              'entertainment_general',
  RECREATION:                 'entertainment_general',
  INVESTMENTS:                'investments_general',
}

const DETAILED_OVERRIDES = {
  FOOD_AND_DRINK_GROCERIES:                'groceries_general',
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR:     'groceries_alcohol',
  FOOD_AND_DRINK_COFFEE:                   'dining_coffee',
  FOOD_AND_DRINK_FAST_FOOD:                'dining_fastFood',
  FOOD_AND_DRINK_RESTAURANT:               'dining_general',
  FOOD_AND_DRINK_VENDING_MACHINES:         'dining_general',
  TRANSPORTATION_GAS:                      'gas_general',
  TRANSPORTATION_FUEL:                     'gas_general',
  TRANSPORTATION_PARKING:                  'transportation_parking',
  TRANSPORTATION_PUBLIC_TRANSIT:            'transportation_publicTransit',
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES:    'transportation_rideshare',
  ENTERTAINMENT_MUSIC_AND_AUDIO:           'subscriptions_streaming',
  ENTERTAINMENT_TV_AND_MOVIES:             'subscriptions_streaming',
  ENTERTAINMENT_VIDEO_GAMES:               'entertainment_gaming',
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: 'entertainment_events',
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: 'shopping_online',
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: 'shopping_clothing',
  GENERAL_MERCHANDISE_ELECTRONICS:         'shopping_electronics',
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: 'education_books',
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY:  'utilities_electric',
  RENT_AND_UTILITIES_INTERNET_AND_CABLE:   'utilities_internet',
  RENT_AND_UTILITIES_TELEPHONE:            'utilities_phone',
  RENT_AND_UTILITIES_WATER:                'utilities_water',
  RENT_AND_UTILITIES_RENT:                 'rent_general',
  MEDICAL_DENTISTS_AND_ORTHODONTISTS:      'health_dental',
  MEDICAL_EYE_CARE:                        'health_vision',
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS:      'health_pharmacy',
  MEDICAL_VETERINARY_SERVICES:             'health_veterinary',
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS:  'health_fitness',
  PERSONAL_CARE_HAIR_AND_BEAUTY:           'personalCare_hairBeauty',
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING:  'personalCare_laundry',
  TRAVEL_FLIGHTS:                          'travel_flights',
  TRAVEL_LODGING:                          'travel_lodging',
  TRAVEL_RENTAL_CARS:                      'travel_rentalCars',
  INVESTMENTS_BROKERAGE:                   'investments_stocks',
  INVESTMENTS_RETIREMENT:                  'investments_retirement',
  INVESTMENTS_CRYPTO:                      'investments_crypto',
  INCOME_WAGES:                            'payroll_wages',
  INCOME_DIVIDENDS:                        'payroll_dividends',
  LOAN_PAYMENTS_MORTGAGE_PAYMENT:          'mortgage_general',
  HOME_IMPROVEMENT_FURNITURE:              'homeImprovement_furniture',
  HOME_IMPROVEMENT_HARDWARE:               'homeImprovement_hardware',
  TRANSFER_IN_ACCOUNT_TRANSFER:            'transfer_general',
  TRANSFER_OUT_ACCOUNT_TRANSFER:           'transfer_general',
  TRANSFER_IN_THIRD_PARTY:                 'venmo_general',
  TRANSFER_OUT_THIRD_PARTY:                'venmo_general',
}

/**
 * Map a Plaid personal_finance_category object to one of the app's subcategory keys.
 *
 * @param {object|null} personalFinanceCategory  - { primary: string, detailed: string }
 * @returns {string} A subcategory key (e.g. 'dining_general', 'groceries_alcohol', 'investments_crypto')
 */
export function mapPlaidCategory(personalFinanceCategory) {
  if (!personalFinanceCategory) return 'other_general'
  const { primary, detailed } = personalFinanceCategory
  if (detailed && DETAILED_OVERRIDES[detailed]) return DETAILED_OVERRIDES[detailed]
  if (primary && PRIMARY_MAP[primary]) return PRIMARY_MAP[primary]
  return 'other_general'
}
