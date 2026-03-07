# Frontend Style Guide

> Reference document for building and normalizing frontend components in the Unemployment Burndown application. All new components and modifications should follow these patterns to maintain visual consistency.

---

## 1. Design Foundations

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 7 |
| Styling | Tailwind CSS 4 + CSS custom properties |
| Icons | Lucide React (`lucide-react`) |
| Charts | Recharts 3.x |
| Font rendering | System font stack (Tailwind default) |

### Theme Architecture

The app uses a **dual-theme system** driven by a `data-theme` attribute on `<html>`:

```
[data-theme="dark"]  ← default
[data-theme="light"]
```

All colors are expressed as **CSS custom properties** defined in `src/index.css`. Components must consume these tokens — never hard-code hex values for surface colors, borders, or text.

---

## 2. Color Tokens

### Backgrounds

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--bg-page` | `#111827` (gray-900) | `#f3f4f6` (gray-100) | Page/app background |
| `--bg-card` | `#1f2937` (gray-800) | `#ffffff` | Card surfaces, panels, sidebars |
| `--bg-input` | `#111827` (gray-900) | `#f9fafb` (gray-50) | Input field backgrounds |
| `--bg-hover` | `#374151` (gray-700) | `#e5e7eb` (gray-200) | Hover states on rows/items |
| `--bg-subtle` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.04)` | Subtle differentiation, toolbar strips |

### Borders

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--border-default` | `#374151` (gray-700) | `#d1d5db` (gray-300) | Card borders, dividers, group separators |
| `--border-subtle` | `rgba(255,255,255,0.06)` | `rgba(0,0,0,0.06)` | Lightweight separators within cards |
| `--border-input` | `#374151` (gray-700) | `#d1d5db` (gray-300) | Input/select borders |

### Text Hierarchy

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--text-primary` | `#f9fafb` (gray-50) | `#111827` (gray-900) | Headlines, balances, primary labels |
| `--text-secondary` | `#9ca3af` (gray-400) | `#4b5563` (gray-600) | Section labels, account names, descriptions |
| `--text-muted` | `#6b7280` (gray-500) | `#6b7280` (gray-500) | Tertiary info, timestamps, helper text |
| `--text-faint` | `#374151` (gray-700) | `#d1d5db` (gray-300) | Barely visible hints (last-4 digits, hidden count) |

### Accent Colors

| Token | Dark | Light | Purpose |
|-------|------|-------|---------|
| `--accent-blue` | `#3b82f6` | `#2563eb` | Primary action, active selections, links, focus rings |
| `--accent-emerald` | `#34d399` | `#059669` | Positive indicators, success states |
| `--accent-teal` | `#2dd4bf` | `#0d9488` | Secondary positive indicators |
| `--accent-red` | `#f87171` | `#dc2626` | Negative/danger, credit card debt subtotals |
| `--accent-amber` | `#fbbf24` | `#d97706` | Warnings, CC payment category |

### Semantic Status Colors (inline, not tokens)

| Status | Color | Example usage |
|--------|-------|---------------|
| Healthy/low utilization | `#34d399` | Credit utilization < 30% |
| Moderate | `#facc15` | Credit utilization 30-59% |
| Elevated | `#fb923c` | Credit utilization 60-89% |
| Critical | `#f87171` | Credit utilization >= 90% |

---

## 3. Chart Category Color Palette

Used in donut charts, bar charts, and progress bars for spending categories. These are defined in `src/constants/categories.js`:

| Category | Color | Hex |
|----------|-------|-----|
| Mortgage | Purple | `#7c3aed` |
| Groceries | Green | `#22c55e` |
| Dining & Restaurants | Orange | `#f97316` |
| Home Improvement | Brown | `#a3623a` |
| Shopping | Pink | `#ec4899` |
| Utilities & Bills | Teal | `#14b8a6` |
| Gas & Fuel | Yellow | `#eab308` |
| Transportation | Slate | `#64748b` |
| Health & Medical | Cyan | `#06b6d4` |
| Subscriptions | Violet | `#8b5cf6` |
| Entertainment | Purple | `#a855f7` |
| Travel & Hotels | Blue | `#3b82f6` |
| Fees & Interest | Red | `#ef4444` |
| Personal Care | Rose | `#f43e5e` |
| Education | Sky | `#0ea5e9` |
| Investments | Emerald | `#10b981` |
| Payroll | Green | `#16a34a` |
| CC Payment | Amber | `#f59e0b` |
| Internal Transfers | Slate | `#94a3b8` |
| Other | Gray | `#6b7280` |

### Donut Chart Expense Slices

For the overview ExpenseDonutChart, categories are grouped into five macro slices:

| Slice | Color | Hex |
|-------|-------|-----|
| Essential | Blue | `#3b82f6` |
| Discretionary | Orange | `#f97316` |
| Subscriptions | Lavender | `#a78bfa` |
| CC Payments | Amber | `#f59e0b` |
| Investments | Teal | `#14b8a6` |

---

## 4. Typography Scale

All sizes use Tailwind's default `text-*` utilities:

| Element | Class | Weight | Tracking | Example |
|---------|-------|--------|----------|---------|
| Section title | `text-sm` | `font-semibold` | `uppercase tracking-wider` | "CREDIT CARDS", "BANKING" |
| Card heading | `text-sm` | `font-bold` | — | "Accounts" |
| Balance / total | `text-sm`–`text-lg` | `font-bold` | `tabular-nums` | "$9,926", "$11,083" |
| Account name | `text-xs` | `font-medium` | — | "Amazon Visa" |
| Metadata / helper | `text-[10px]` | `font-semibold` | `uppercase tracking-wider` | "CHECKING", "4 stmts" |
| Percentage label | `text-xs` | — | `tabular-nums` | "34%", "23%" |
| Faint detail | `text-[10px]` | — | — | "As of Mar 06, 2026" |
| Chart tooltip heading | `text-sm` | `font-semibold` | — | Category name |
| Chart center value | `text-lg` | `font-bold` | — | "$11,083" |

### Currency Formatting

All monetary values use `formatCurrency()` from `src/utils/formatters.js` and must include `tabular-nums` for alignment in lists and tables.

---

## 5. Component Patterns

### SectionCard (Base Container)

The standard container wrapping all content sections:

```jsx
<div className="theme-card rounded-xl border p-5">
  {/* content */}
</div>
```

**Key properties:**
- `theme-card` applies `background-color: var(--bg-card)` and `border-color: var(--border-default)`
- Border radius: `rounded-xl` (0.75rem)
- Padding: `p-5` (1.25rem)
- Optional title: `text-sm font-semibold uppercase tracking-wider` in `--text-secondary`

### Fixed Sidebar Panel (Accounts Sidebar)

Desktop sidebars use fixed positioning with card styling:

```
width: 16rem
top: 5.5rem
left: 0.75rem
maxHeight: calc(100vh - 7rem)
background: var(--bg-card)
border: 1px solid var(--border-default)
borderRadius: rounded-xl
boxShadow: 0 1px 8px rgba(0,0,0,0.08)
```

### Tabbed Card (StatementChartTabs)

Cards with inline tab navigation:

```
Container:      theme-card rounded-xl border overflow-hidden
Tab bar bg:     var(--bg-subtle, var(--bg-card))
Tab bar border: borderBottom: 1px solid var(--border-default)
Active tab:     var(--text-primary), bg var(--bg-card), 2px blue underline
Inactive tab:   var(--text-muted)
Hovered tab:    var(--text-secondary), bg var(--bg-hover)
Active underline: height 2px, background var(--accent-blue)
Description strip: px-4 py-1.5, bg var(--bg-subtle), text-xs var(--text-muted)
```

---

## 6. Interactive Element Patterns

### Selection Highlighting (Active Item)

Used in account lists, tab pills, and filters:

```
Active background:   color-mix(in srgb, var(--accent-blue) 12%, var(--bg-card))
Active text:         var(--accent-blue)
Active border-left:  2px solid var(--accent-blue)
Inactive background: transparent
Inactive text:       var(--text-secondary)
```

### Filter Pills / Category Tags

Rounded-full pills with category color tinting:

```jsx
// Active filter pill
background: `${cat.color}18`         // 18 = ~9% opacity hex suffix
color: cat.color
border: `1px solid ${cat.color}40`    // 40 = ~25% opacity

// Hidden/inactive pill
background: var(--bg-subtle)
color: var(--text-muted)
border: 1px solid var(--border-subtle)
opacity: 0.45
textDecoration: line-through
```

### Buttons

**Icon-only action buttons** (Settings, Refresh, Collapse):
```
padding: p-1
color: var(--text-muted) (default), var(--accent-blue) (active/loading)
```

**Primary text link / action** (Add Account):
```
color: var(--accent-blue)
icon background: color-mix(in srgb, var(--accent-blue) 15%, transparent)
hover background: color-mix(in srgb, var(--accent-blue) 6%, var(--bg-card))
```

### Focus Ring

Standard focus style for inputs and selects:

```css
border-color: var(--accent-blue);
box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-blue) 30%, transparent);
```

---

## 7. Spacing & Layout Conventions

| Context | Spacing |
|---------|---------|
| Card padding | `p-5` (1.25rem) |
| Inner horizontal padding | `px-3` to `px-4` |
| Item vertical padding | `py-1.5` to `py-2.5` |
| Gap between legend rows | `space-y-3` |
| Gap between pill elements | `gap-1.5` to `gap-2` |
| Section separation | `1px solid var(--border-default)` or `1px solid var(--border-subtle)` |
| Chart + Legend layout | `flex flex-col sm:flex-row items-start gap-6` |
| Mobile row card styling | `bg-hover`, `rounded-lg` (8px), `padding 8px` |

### Responsive Breakpoints

- **Mobile** (`< 640px`): Stack layouts, pill-based account selection, 16px minimum input font
- **Desktop** (`sm` / 640px+): Side-by-side layouts, grid-based rows
- **Large desktop** (`xl` / 1280px+): Fixed sidebars, expanded navigation

---

## 8. Progress Bars

Used in category breakdowns and donut chart legends:

```jsx
// Track
<div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1f2937' }}>
  // Fill
  <div
    className="h-full rounded-full transition-all duration-300"
    style={{
      width: `${percentage}%`,
      background: categoryColor,
      opacity: isHovered ? 1 : 0.7,
    }}
  />
</div>
```

---

## 9. Tooltips (Chart)

Recharts custom tooltips follow this card pattern:

```
background: #111827 (dark card surface)
border: 1px solid #374151
borderRadius: rounded-xl
padding: px-3 py-2.5
shadow: shadow-2xl
```

Content hierarchy:
1. **Title**: `text-sm font-semibold text-white`
2. **Value**: `text-sm font-bold` in category color, with `/mo` suffix in `text-xs opacity-60`
3. **Percentage**: `text-xs` in `#6b7280`
4. **Sub-items**: `text-xs` in `#9ca3af`, separated by `1px solid #374151`

---

## 10. Person/Avatar Badges

Small circular badges for household member identification:

```
Size: w-4 h-4 (16px)
Shape: rounded-full
Font: text-[8px] font-bold text-white uppercase
```

Available badge colors:
- `bg-blue-500`
- `bg-purple-500`
- `bg-emerald-500`
- `bg-amber-400`
- `bg-rose-500`
- `bg-cyan-500`

---

## 11. Account Type Badges

Subtype labels for banking accounts (checking, savings):

```jsx
<span
  className="px-1 py-0 rounded text-[10px] font-semibold uppercase tracking-wide"
  style={{
    background: 'color-mix(in srgb, var(--text-muted) 15%, transparent)',
    color: 'var(--text-muted)',
  }}
>
  CHECKING
</span>
```

---

## 12. Toggle Switches

iOS-style mini toggle used for feature flags in charts:

```
Track size: w-7 h-4 (small)
Dot size: h-2.5 w-2.5
Active track: var(--accent-blue)
Inactive track: #374151
Dot color: white
Animation: transition-transform duration-200
```

---

## 13. Transitions & Animation

| Element | Transition | Duration |
|---------|-----------|----------|
| Theme switch (body) | `background-color, color` | `0.2s ease` |
| Hover states | `transition-colors` | Tailwind default (150ms) |
| Selection highlights | `transition-all` | Tailwind default |
| Progress bar fill | `transition-all` | `duration-300` |
| Donut hover expand | `transform scale(1.3)` on legend dot | Tailwind default |
| Drawer reveal | `max-height, opacity, margin` | `duration-200` |
| Spinner | `animate-spin` | On sync/refresh icons |

---

## 14. Hidden/Demo Mode

Sensitive financial data supports blurring for screenshots and demos:

```css
/* Applied when data-hidden-mode="true" on a parent element */
.sensitive {
  filter: blur(10px);
  user-select: none;
  pointer-events: none;
}

.sensitive-chart {
  filter: blur(14px);
  user-select: none;
  pointer-events: none;
}
```

---

## 15. Do's and Don'ts

### Do

- Use CSS custom property tokens for all surface colors, borders, and text colors
- Use `color-mix(in srgb, ...)` for transparent tinting of accent colors
- Use `tabular-nums` on all numeric/currency values for alignment
- Use `theme-card rounded-xl border` as the base card class
- Use Lucide icons at size 12-16 with `strokeWidth={1.75}`
- Format all currency with `formatCurrency()` from utils
- Add `transition-colors` or `transition-all` to interactive elements
- Mark sensitive content with `sensitive` or `sensitive-chart` classes

### Don't

- Hard-code hex color values for backgrounds, borders, or text (use tokens)
- Mix styling systems (stick to Tailwind + inline `style` for token variables)
- Use `font-size` smaller than 10px (`text-[10px]` is the floor)
- Skip `tabular-nums` on financial figures
- Use Tailwind `dark:` classes directly — the custom variant handles theming via `data-theme`
- Add non-system fonts without team approval
- Create custom CSS classes when Tailwind utilities suffice
