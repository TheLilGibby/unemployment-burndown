# Unemployment Burndown

> Financial burndown tracker for unemployment — helps users track savings depletion during job transitions.

[![Built with React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-purple?logo=vite)](https://vite.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4-cyan?logo=tailwindcss)](https://tailwindcss.com)

## Features

- 📊 **Burndown Projections** — Visual charts showing savings depletion over time
- 🏦 **Bank Account Linking** — Connect accounts via Plaid for real-time data
- 🎯 **Scenario Modeling** — Plan for different job transition outcomes
- 👥 **Multi-User Households** — Support for families with organization membership
- 🔔 **Milestone Notifications** — Alerts when burndown hits key thresholds (50%, 30 days to zero, etc.)
- 📑 **Statement Categorization** — Import and categorize transactions for accurate projections

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, TailwindCSS 4, Recharts, React Router 7 |
| **Backend** | Express 5 (dev), AWS Lambda (prod) |
| **Banking** | Plaid API |
| **Auth** | JWT + MFA (TOTP with QR codes) |
| **Infrastructure** | AWS Amplify, S3, SAM |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- AWS CLI (for deployment)
- Plaid sandbox credentials ([sign up free](https://plaid.com))

### Installation

```bash
git clone https://github.com/RAG-Consulting-LLC/unemployment-burndown.git
cd unemployment-burndown
npm install
cp .env.example .env
# Edit .env with your credentials
```

### Development

```bash
npm run dev:all  # Runs frontend + backend concurrently
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3000 |

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run server` | Start Express server (backend only) |
| `npm run dev:all` | Start both frontend and backend |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Project Structure

```
unemployment-burndown/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/              # Route pages (Burndown, CreditCardHub, etc.)
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React context providers
│   ├── utils/              # Utility functions
│   └── constants/          # App constants
├── server/                 # Express development server
│   └── index.mjs
├── backend/                # AWS Lambda functions
│   ├── src/
│   └── template.yaml       # SAM template
├── infrastructure/         # AWS infrastructure
│   └── template.yaml       # SAM template
├── docs/                   # Documentation
│   ├── data-retention-policy.md
│   └── information-security-policy.md
└── scripts/                # Setup utilities
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `AWS_REGION` | AWS region (e.g., `us-west-1`) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SANDBOX_SECRET` | Plaid sandbox secret |
| `SENDGRID_API_KEY` | SendGrid API key for emails |
| `JWT_SECRET` | Secret for JWT tokens (min 32 chars) |
| `VITE_APP_USERNAME` | Basic auth username (dev only) |
| `VITE_APP_PASSWORD` | Basic auth password (dev only) |

## Deployment

The app deploys to **AWS Amplify**. Build configuration is in `amplify.yml`.

```bash
# Build for production
npm run build

# Deploy via Amplify Console or CLI
```

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit changes following conventional commits (`feat:`, `fix:`, `chore:`)
4. Push and open a PR against `main`

## Documentation

- [Data Retention Policy](docs/data-retention-policy.md)
- [Information Security Policy](docs/information-security-policy.md)

## License

Private — © 2026 RAG Consulting LLC. All rights reserved.
