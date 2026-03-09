# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev:all          # Start frontend (Vite :5173) + backend (Express :3001) concurrently
npm run dev              # Frontend only
npm run server           # Backend only (Express dev server with self-signed TLS)
npm run dev:local        # Frontend + backend with USE_LOCAL_DATA=true (no AWS)
npm run build            # Production build (Vite)
npm run lint             # ESLint (flat config, ESM)
npm test                 # Vitest in watch mode (frontend)
npm run test:run         # Vitest single run (frontend)
npx vitest run src/utils/formatters.test.js   # Run a single test file
```

Backend tests live in `backend/` with their own vitest config:
```bash
cd backend && npx vitest run                          # All backend tests
cd backend && npx vitest run src/handlers/register.test.mjs  # Single backend test
```

## Architecture

**Frontend** — React 19 SPA with Vite 7, TailwindCSS 4, React Router 7. Entry point: `src/main.jsx` → `src/App.jsx`. App.jsx is the central orchestrator — it initializes all major hooks, manages state, and passes props down to page routes. There is no Redux or global state management library; state flows through hooks and prop drilling from App.

**Backend (dev)** — `server/index.mjs` is a monolithic Express 5 server that mirrors all Lambda endpoints for local development. It runs on HTTPS (self-signed certs via `server/tls.mjs`). Vite proxies `/api` and `/plaid` requests to `https://localhost:3001`.

**Backend (prod)** — `backend/` contains AWS SAM Lambda functions. Each handler in `backend/src/handlers/` is a separate Lambda. Shared logic lives in `backend/src/lib/` (auth, dynamo, s3, plaid, encryption, rate limiting, email, SMS). The SAM template is `backend/template.yaml`.

**Key data flow:** User financial data (savings, expenses, unemployment benefits, what-if scenarios) is stored as a single `data.json` blob in S3 per user. The `useBurndown` hook computes daily burndown projections from this data. `usePersistedState` handles localStorage persistence with cloud sync via S3.

### Important patterns

- **Auth:** JWT + optional TOTP MFA. Tokens stored in `sessionStorage`. `useAuth` hook handles login/register/refresh/MFA flows. Backend auth utilities in `backend/src/lib/auth.mjs`.
- **Banking integrations:** Plaid (bank accounts/transactions) and SnapTrade (investment accounts). Each has dedicated hooks (`usePlaid`, `useSnapTrade`) and backend handlers.
- **Multi-user households:** Organization/household model where users share data. Managed through org invite codes and membership roles.
- **Theming:** CSS variables for theme colors. Components should use `var(--chart-*)` CSS variables instead of hardcoded hex colors in charts.
- **Test utilities:** `src/test/test-utils.jsx` exports a custom `render` that wraps components in ThemeProvider + ToastProvider + BrowserRouter. Use this instead of raw `@testing-library/react` render.

### Frontend structure

- `src/pages/` — Route-level page components (BurndownPage, CreditCardHubPage, GoalsPage, etc.)
- `src/components/` — Organized by domain (chart/, auth/, plaid/, scenarios/, statements/, etc.)
- `src/hooks/` — Custom hooks that encapsulate business logic and API calls
- `src/context/` — Theme, Toast, HiddenMode, Notifications, Comments contexts
- `src/utils/` — Pure utility functions (formatters, validators, transaction matching)
- `src/constants/defaults.js` — Default data shapes for all financial entities

## Conventions

- ESM throughout (`"type": "module"` in package.json). Backend files use `.mjs` extension.
- ESLint flat config with react-hooks and react-refresh plugins. Unused vars prefixed with `_` are allowed.
- Vitest with globals enabled — no need to import `describe`, `it`, `expect`, `vi`.
- Frontend tests use jsdom environment; backend tests use default (node) environment.
- Conventional commits: `feat:`, `fix:`, `chore:`.
- `dayjs` for all date handling (not native Date or moment).
