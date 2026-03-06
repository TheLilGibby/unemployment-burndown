export const STATEMENT_CATEGORIES = [
  {
    key: 'dining', label: 'Dining & Restaurants', color: '#f97316',
    description: 'Spending at restaurants, cafes, bars, and food service establishments',
    subCategories: [
      { key: 'dining_general',  label: 'Dining',             color: '#f97316', description: 'Restaurant meals, takeout, food delivery, and other dining' },
      { key: 'dining_coffee',   label: 'Coffee & Cafes',    color: '#d97706', description: 'Coffee shops, tea houses, and cafe purchases' },
      { key: 'dining_fastFood', label: 'Fast Food',         color: '#ea580c', description: 'Fast food restaurants and quick-service chains' },
      { key: 'dining_bars',     label: 'Bars & Nightlife',  color: '#c2410c', description: 'Bars, pubs, nightclubs, and alcoholic beverage venues' },
    ],
  },
  {
    key: 'groceries', label: 'Groceries', color: '#22c55e',
    description: 'Grocery stores, supermarkets, and food supply purchases',
    subCategories: [
      { key: 'groceries_general',  label: 'Groceries',           color: '#22c55e', description: 'Supermarkets, grocery stores, and general food shopping' },
      { key: 'groceries_delivery', label: 'Grocery Delivery',    color: '#16a34a', description: 'Grocery delivery services (Instacart, Amazon Fresh, etc.)' },
      { key: 'groceries_alcohol',  label: 'Beer, Wine & Liquor', color: '#15803d', description: 'Liquor stores, wine shops, and alcohol purchases from stores' },
    ],
  },
  {
    key: 'gas', label: 'Gas & Fuel', color: '#eab308',
    description: 'Fuel and vehicle charging expenses',
    subCategories: [
      { key: 'gas_general', label: 'Gas & Fuel',          color: '#eab308', description: 'Gas stations and traditional fuel purchases' },
      { key: 'gas_ev',      label: 'EV Charging',        color: '#ca8a04', description: 'Electric vehicle charging stations and services' },
    ],
  },
  {
    key: 'travel', label: 'Travel & Hotels', color: '#3b82f6',
    description: 'Travel-related expenses including flights, hotels, and car rentals',
    subCategories: [
      { key: 'travel_general',    label: 'Travel',           color: '#3b82f6', description: 'General travel expenses, travel agencies, and booking services' },
      { key: 'travel_flights',    label: 'Flights',         color: '#2563eb', description: 'Airline tickets and air travel' },
      { key: 'travel_lodging',    label: 'Hotels & Lodging', color: '#1d4ed8', description: 'Hotels, motels, Airbnb, and other lodging' },
      { key: 'travel_rentalCars', label: 'Rental Cars',     color: '#60a5fa', description: 'Car rentals and vehicle hire services' },
    ],
  },
  {
    key: 'entertainment', label: 'Entertainment', color: '#a855f7',
    description: 'Entertainment, events, and recreational activities',
    subCategories: [
      { key: 'entertainment_general', label: 'Entertainment',         color: '#a855f7', description: 'General entertainment and recreation expenses' },
      { key: 'entertainment_events',  label: 'Events & Live',        color: '#9333ea', description: 'Concerts, sporting events, museums, amusement parks, and live entertainment' },
      { key: 'entertainment_gaming',  label: 'Gaming',               color: '#7c3aed', description: 'Video games, gaming subscriptions, and gaming hardware' },
    ],
  },
  {
    key: 'shopping', label: 'Shopping', color: '#ec4899',
    description: 'Retail shopping including online and in-store purchases',
    subCategories: [
      { key: 'shopping_general',     label: 'Shopping',               color: '#ec4899', description: 'General retail, department stores, and miscellaneous shopping' },
      { key: 'shopping_online',      label: 'Online / Marketplace',  color: '#db2777', description: 'Online marketplaces (Amazon, eBay) and e-commerce' },
      { key: 'shopping_clothing',    label: 'Clothing & Accessories', color: '#be185d', description: 'Clothing stores, shoes, jewelry, and fashion accessories' },
      { key: 'shopping_electronics', label: 'Electronics',           color: '#f472b6', description: 'Electronics, computers, phones, and tech accessories' },
    ],
  },
  {
    key: 'subscriptions', label: 'Subscriptions', color: '#8b5cf6',
    description: 'Recurring subscription services and memberships',
    subCategories: [
      { key: 'subscriptions_general',   label: 'Subscriptions',         color: '#8b5cf6', description: 'General recurring subscriptions and memberships' },
      { key: 'subscriptions_streaming', label: 'Streaming Services',    color: '#7c3aed', description: 'Video, music, and audio streaming (Netflix, Spotify, etc.)' },
      { key: 'subscriptions_software',  label: 'Software & SaaS',      color: '#6d28d9', description: 'Software subscriptions, cloud services, and SaaS tools' },
    ],
  },
  {
    key: 'health', label: 'Health & Medical', color: '#06b6d4',
    description: 'Healthcare, medical, dental, and wellness expenses',
    subCategories: [
      { key: 'health_general',    label: 'Health',              color: '#06b6d4', description: 'General medical expenses, doctor visits, and healthcare' },
      { key: 'health_dental',     label: 'Dental',             color: '#0891b2', description: 'Dentists, orthodontists, and dental care' },
      { key: 'health_vision',     label: 'Vision & Eye Care',  color: '#0e7490', description: 'Optometrists, ophthalmologists, glasses, and contacts' },
      { key: 'health_pharmacy',   label: 'Pharmacy',           color: '#22d3ee', description: 'Pharmacies, prescriptions, and over-the-counter medications' },
      { key: 'health_fitness',    label: 'Gym & Fitness',      color: '#67e8f9', description: 'Gyms, fitness centers, personal training, and fitness classes' },
      { key: 'health_veterinary', label: 'Veterinary',         color: '#155e75', description: 'Veterinary services and pet healthcare' },
    ],
  },
  {
    key: 'utilities', label: 'Utilities & Bills', color: '#14b8a6',
    description: 'Household utility and service bills',
    subCategories: [
      { key: 'utilities_general',  label: 'Utilities',         color: '#14b8a6', description: 'General utility bills and household services' },
      { key: 'utilities_electric', label: 'Electric & Gas',    color: '#0d9488', description: 'Electric and natural gas utility bills' },
      { key: 'utilities_internet', label: 'Internet & Cable',  color: '#0f766e', description: 'Internet service, cable TV, and broadband' },
      { key: 'utilities_phone',    label: 'Phone',             color: '#2dd4bf', description: 'Cell phone and telephone service bills' },
      { key: 'utilities_water',    label: 'Water & Sewer',     color: '#115e59', description: 'Water, sewer, and waste management services' },
    ],
  },
  {
    key: 'transportation', label: 'Transportation', color: '#64748b',
    description: 'Non-fuel transportation expenses',
    subCategories: [
      { key: 'transportation_general',       label: 'Transportation',         color: '#64748b', description: 'General transportation and commuting expenses' },
      { key: 'transportation_rideshare',     label: 'Rideshare',              color: '#475569', description: 'Uber, Lyft, taxis, and ride-hailing services' },
      { key: 'transportation_publicTransit', label: 'Public Transit',         color: '#334155', description: 'Bus, subway, train, and public transportation' },
      { key: 'transportation_parking',       label: 'Parking & Tolls',        color: '#94a3b8', description: 'Parking fees, meters, garages, and highway tolls' },
    ],
  },
  {
    key: 'education', label: 'Education', color: '#0ea5e9',
    description: 'Educational expenses and learning materials',
    subCategories: [
      { key: 'education_general', label: 'Education',         color: '#0ea5e9', description: 'General educational expenses and courses' },
      { key: 'education_tuition', label: 'Tuition & Fees',    color: '#0284c7', description: 'Tuition, school fees, and academic program costs' },
      { key: 'education_books',   label: 'Books & Supplies',  color: '#38bdf8', description: 'Textbooks, school supplies, and educational materials' },
    ],
  },
  {
    key: 'personalCare', label: 'Personal Care', color: '#f43e5e',
    description: 'Personal care, grooming, and beauty services',
    subCategories: [
      { key: 'personalCare_general',    label: 'Personal Care',           color: '#f43e5e', description: 'General personal care and grooming expenses' },
      { key: 'personalCare_hairBeauty', label: 'Hair & Beauty',          color: '#e11d48', description: 'Salons, barbers, spas, and beauty treatments' },
      { key: 'personalCare_laundry',    label: 'Laundry & Dry Cleaning', color: '#fb7185', description: 'Laundromats, dry cleaners, and clothing care' },
    ],
  },
  {
    key: 'fees', label: 'Fees & Interest', color: '#ef4444',
    description: 'Bank fees, interest charges, and financial penalties',
    subCategories: [
      { key: 'fees_general',  label: 'Fees',              color: '#ef4444', description: 'General fees and miscellaneous financial charges' },
      { key: 'fees_bankFees', label: 'Bank Fees',        color: '#dc2626', description: 'ATM fees, overdraft fees, and account maintenance fees' },
      { key: 'fees_interest', label: 'Interest Charges',  color: '#b91c1c', description: 'Credit card interest, loan interest, and finance charges' },
      { key: 'fees_lateFees', label: 'Late Fees',         color: '#f87171', description: 'Late payment penalties and past-due charges' },
    ],
  },
  {
    key: 'homeImprovement', label: 'Home Improvement', color: '#a3623a',
    description: 'Home improvement, furnishing, and maintenance expenses',
    subCategories: [
      { key: 'homeImprovement_general',     label: 'Home Improvement',         color: '#a3623a', description: 'General home improvement and maintenance' },
      { key: 'homeImprovement_furniture',   label: 'Furniture',                color: '#92400e', description: 'Furniture, home decor, and furnishings' },
      { key: 'homeImprovement_hardware',    label: 'Hardware & Tools',         color: '#78350f', description: 'Hardware stores, tools, and building materials' },
      { key: 'homeImprovement_contractors', label: 'Contractors',              color: '#b45309', description: 'Contractors, renovation services, and professional repairs' },
    ],
  },
  {
    key: 'investments', label: 'Investments', color: '#10b981',
    description: 'Investment transactions and portfolio activity',
    subCategories: [
      { key: 'investments_general',    label: 'Investments',         color: '#10b981', description: 'General investment transactions' },
      { key: 'investments_crypto',     label: 'Crypto',             color: '#f59e0b', description: 'Cryptocurrency purchases and exchanges' },
      { key: 'investments_retirement', label: 'Retirement',         color: '#6366f1', description: '401k, IRA, pension, and retirement account contributions' },
      { key: 'investments_stocks',     label: 'Stocks & ETFs',      color: '#059669', description: 'Stock, ETF, and mutual fund purchases and sales' },
    ],
  },
  {
    key: 'payroll', label: 'Payroll', color: '#16a34a',
    description: 'Income from employment and earnings',
    subCategories: [
      { key: 'payroll_general',   label: 'Payroll',                color: '#16a34a', description: 'General payroll and income deposits' },
      { key: 'payroll_wages',     label: 'Wages & Salary',         color: '#15803d', description: 'Regular wages, salary, and hourly pay' },
      { key: 'payroll_dividends', label: 'Dividends & Interest',   color: '#166534', description: 'Dividend payments and interest income' },
    ],
  },
  {
    key: 'mortgage', label: 'Mortgage', color: '#7c3aed',
    description: 'Mortgage payments and home loan expenses',
    subCategories: [
      { key: 'mortgage_general', label: 'Mortgage',         color: '#7c3aed', description: 'Mortgage payments, home loan principal and interest' },
    ],
  },
  {
    key: 'rent', label: 'Rent', color: '#0d9488',
    description: 'Rent payments for housing',
    subCategories: [
      { key: 'rent_general', label: 'Rent',          color: '#0d9488', description: 'Monthly rent and lease payments' },
    ],
  },
  {
    key: 'ccPayment', label: 'CC Payment', color: '#f59e0b',
    description: 'Credit card bill payments',
    subCategories: [
      { key: 'ccPayment_general', label: 'CC Payment',         color: '#f59e0b', description: 'Credit card bill payments and balance transfers' },
    ],
  },
  {
    key: 'transfer', label: 'Internal Transfers', color: '#94a3b8',
    description: 'Transfers between own accounts and P2P payments',
    subCategories: [
      { key: 'transfer_general', label: 'Transfer',         color: '#94a3b8', description: 'Internal account-to-account transfers and P2P payments' },
    ],
  },
  {
    key: 'other', label: 'Other', color: '#6b7280',
    description: 'Transactions that do not fit other categories',
    subCategories: [
      { key: 'other_general',    label: 'Uncategorized',           color: '#6b7280', description: 'Uncategorized or miscellaneous transactions' },
      { key: 'other_government', label: 'Government & Taxes',      color: '#4b5563', description: 'Tax payments, government fees, and civic expenses' },
      { key: 'other_charity',    label: 'Charitable Giving',       color: '#9ca3af', description: 'Donations, charitable contributions, and non-profit giving' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Backward compatibility: map legacy bare-parent keys to their _general sub
// ---------------------------------------------------------------------------

export const LEGACY_KEY_MAP = {
  dining: 'dining_general',
  groceries: 'groceries_general',
  gas: 'gas_general',
  travel: 'travel_general',
  entertainment: 'entertainment_general',
  shopping: 'shopping_general',
  subscriptions: 'subscriptions_general',
  health: 'health_general',
  utilities: 'utilities_general',
  transportation: 'transportation_general',
  education: 'education_general',
  personalCare: 'personalCare_general',
  fees: 'fees_general',
  homeImprovement: 'homeImprovement_general',
  investments: 'investments_general',
  payroll: 'payroll_general',
  mortgage: 'mortgage_general',
  rent: 'rent_general',
  ccPayment: 'ccPayment_general',
  transfer: 'transfer_general',
  other: 'other_general',
}

/**
 * Migration map for deprecated category keys.
 * Maps old venmo keys to their two-tier replacement categories.
 */
export const DEPRECATED_CATEGORY_MAP = {
  venmo: 'transfer_general',
  venmo_rent: 'rent_general',
  venmo_bills: 'utilities_general',
  venmo_personal: 'other_general',
  venmo_general: 'transfer_general',
}

/**
 * Resolve a category key to its canonical subcategory key.
 * Handles both legacy bare-parent keys and deprecated keys.
 */
export function resolveCategory(key) {
  return DEPRECATED_CATEGORY_MAP[key] || LEGACY_KEY_MAP[key] || key
}

/**
 * Migrate a category key, replacing deprecated keys with their successors.
 */
export function migrateCategory(key) {
  return DEPRECATED_CATEGORY_MAP[key] || key
}

/**
 * Look up a category (or sub-category) config by key.
 * Resolves legacy and deprecated keys through resolveCategory.
 * Returns the matching { key, label, color, description } or null.
 */
export function findCategory(key) {
  const resolved = resolveCategory(key)
  for (const cat of STATEMENT_CATEGORIES) {
    for (const sub of cat.subCategories) {
      if (sub.key === resolved) return sub
    }
  }
  return null
}

/**
 * Return the parent category key for a given key.
 * Resolves legacy and deprecated keys through resolveCategory.
 */
export function getParentCategoryKey(key) {
  const resolved = resolveCategory(key)
  for (const cat of STATEMENT_CATEGORIES) {
    if (cat.subCategories.some(s => s.key === resolved)) return cat.key
  }
  return 'other'
}

/**
 * Return the full parent category object for a given key.
 * Resolves legacy and deprecated keys through resolveCategory.
 */
export function findParentCategory(key) {
  const resolved = resolveCategory(key)
  for (const cat of STATEMENT_CATEGORIES) {
    if (cat.subCategories.some(s => s.key === resolved)) return cat
  }
  return null
}

/**
 * Check whether a subcategory key is the _general variant of its parent.
 */
export function isGeneralCategory(key) {
  const resolved = resolveCategory(key)
  return resolved.endsWith('_general')
}

/** Flat list of every valid subcategory key (the only assignable values). */
export const ALL_CATEGORY_KEYS = STATEMENT_CATEGORIES.flatMap(c =>
  c.subCategories.map(s => s.key)
)

/**
 * Structured category schema for AI agent consumption.
 * Provides the complete taxonomy with descriptions, key naming convention,
 * valid keys, and legacy key mapping for interpreting existing data.
 */
export const categorySchema = {
  version: '2.0',
  description: 'Two-tier personal finance transaction categorization schema. Every transaction should be assigned a subcategory key (format: parentKey_subKey). Use the _general subcategory when no more specific subcategory applies.',
  keyFormat: 'parentKey_subKey',
  categories: STATEMENT_CATEGORIES.map(cat => ({
    key: cat.key,
    label: cat.label,
    color: cat.color,
    description: cat.description,
    subCategories: cat.subCategories.map(sub => ({
      key: sub.key,
      label: sub.label,
      color: sub.color,
      description: sub.description,
    })),
  })),
  allValidKeys: ALL_CATEGORY_KEYS,
  legacyKeyMap: LEGACY_KEY_MAP,
  deprecatedKeyMap: DEPRECATED_CATEGORY_MAP,
}
