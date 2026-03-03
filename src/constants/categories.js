export const STATEMENT_CATEGORIES = [
  { key: 'dining',         label: 'Dining & Restaurants', color: '#f97316' },
  { key: 'groceries',      label: 'Groceries',            color: '#22c55e' },
  { key: 'gas',            label: 'Gas & Fuel',           color: '#eab308' },
  { key: 'travel',         label: 'Travel & Hotels',      color: '#3b82f6' },
  { key: 'entertainment',  label: 'Entertainment',        color: '#a855f7' },
  { key: 'shopping',       label: 'Shopping',             color: '#ec4899' },
  { key: 'subscriptions',  label: 'Subscriptions',        color: '#8b5cf6' },
  { key: 'health',         label: 'Health & Medical',     color: '#06b6d4' },
  { key: 'utilities',      label: 'Utilities & Bills',    color: '#14b8a6' },
  { key: 'transportation', label: 'Transportation',       color: '#64748b' },
  { key: 'education',      label: 'Education',            color: '#0ea5e9' },
  { key: 'personalCare',   label: 'Personal Care',        color: '#f43e5e' },
  { key: 'fees',           label: 'Fees & Interest',      color: '#ef4444' },
  { key: 'homeImprovement', label: 'Home Improvement',   color: '#a3623a' },
  { key: 'investments',    label: 'Investments',          color: '#10b981',
    subCategories: [
      { key: 'investments_crypto',     label: 'Crypto',     color: '#f59e0b' },
      { key: 'investments_retirement', label: 'Retirement', color: '#6366f1' },
      { key: 'investments_stocks',     label: 'Stocks',     color: '#059669' },
    ],
  },
  { key: 'venmo',          label: 'Venmo & P2P',          color: '#008cff',
    subCategories: [
      { key: 'venmo_rent',      label: 'Rent / Mortgage', color: '#0d9488' },
      { key: 'venmo_bills',     label: 'Bills & Utilities', color: '#0891b2' },
      { key: 'venmo_personal',  label: 'Personal',        color: '#6366f1' },
    ],
  },
  { key: 'other',          label: 'Other',                color: '#6b7280' },
]

/**
 * Look up a category (or sub-category) config by key.
 * Returns the matching { key, label, color } or null.
 */
export function findCategory(key) {
  for (const cat of STATEMENT_CATEGORIES) {
    if (cat.key === key) return cat
    if (cat.subCategories) {
      const sub = cat.subCategories.find(s => s.key === key)
      if (sub) return sub
    }
  }
  return null
}

/**
 * Return the parent category key for a given key.
 * If the key is itself a top-level category, returns that key.
 * If it's a sub-category, returns the parent's key.
 */
export function getParentCategoryKey(key) {
  for (const cat of STATEMENT_CATEGORIES) {
    if (cat.key === key) return key
    if (cat.subCategories?.some(s => s.key === key)) return cat.key
  }
  return 'other'
}

/** Flat list of every valid category key (top-level + sub-categories). */
export const ALL_CATEGORY_KEYS = STATEMENT_CATEGORIES.flatMap(c =>
  c.subCategories ? [c.key, ...c.subCategories.map(s => s.key)] : [c.key]
)
