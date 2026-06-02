# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack e-commerce application with two separate projects:
- **`backend/`** — Medusa v2 headless commerce server (Node.js, TypeScript, runs on port 9000)
- **`backend-storefront/`** — Next.js 15 storefront (TypeScript, Tailwind CSS, runs on port 8000)

The storefront communicates with the backend via `@medusajs/js-sdk` configured in `backend-storefront/src/lib/config.ts`.

## Commands

### Backend (`cd backend`)

```bash
npm run dev          # Start development server (with hot reload)
npm run build        # Build for production
npm run start        # Start production server
npm run seed         # Seed database with sample data

# Database
npx medusa db:generate <module-name>   # Generate migrations for a module
npx medusa db:migrate                  # Run pending migrations

# Tests
npm run test:unit                      # Unit tests (src/**/__tests__/**/*.unit.spec.ts)
npm run test:integration:http          # HTTP integration tests (integration-tests/http/*.spec.ts)
npm run test:integration:modules       # Module integration tests (src/modules/*/__tests__/**/*.ts)
```

### Storefront (`cd backend-storefront`)

```bash
npm run dev      # Start dev server with Turbopack on port 8000
npm run build    # Build for production
npm run lint     # Run ESLint
npm run analyze  # Bundle analysis (ANALYZE=true next build)
```

## Backend Architecture

Medusa v2 uses a modular architecture. All customizations live in `src/`:

- **`src/api/`** — Custom REST API routes. File-based routing: `src/api/store/my-route/route.ts` creates `/store/my-route`. Export named functions (`GET`, `POST`, etc.). Access the DI container via `req.scope`.
- **`src/modules/`** — Custom modules (data models + services). Each module needs: `models/`, `service.ts` extending `MedusaService`, and `index.ts` exporting `Module(...)`. After creating a module, register it in `medusa-config.ts` and generate/run migrations.
- **`src/workflows/`** — Business logic as composable steps. Created with `createWorkflow` and `createStep` from `@medusajs/framework/workflows-sdk`. Workflows are invoked from API routes, subscribers, or scheduled jobs.
- **`src/links/`** — Module link definitions connecting custom modules to Medusa's core commerce modules.
- **`src/subscribers/`** — Event subscribers triggered by Medusa events.
- **`src/jobs/`** — Scheduled jobs.
- **`src/admin/`** — Admin dashboard customizations (widgets, UI routes). Built with React/Vite.
- **`src/scripts/seed.ts`** — Database seeding script executed via `medusa exec`.

Configuration is in `medusa-config.ts` (database URL, CORS, JWT/cookie secrets, registered modules).

## Storefront Architecture

Next.js 15 App Router with country-code-prefixed routing:

- **`src/app/[countryCode]/(main)/`** — Main storefront pages (home, products, categories, collections, account, cart, orders)
- **`src/app/[countryCode]/(checkout)/`** — Checkout flow (separate layout)
- **`src/middleware.ts`** — Intercepts all requests, fetches Medusa regions, redirects to `/{countryCode}/...`. Regions are cached for 1 hour. Country code is determined from URL > Vercel geo header > `NEXT_PUBLIC_DEFAULT_REGION` env var.
- **`src/lib/data/`** — Server-side data fetching functions (products, cart, customer, orders, etc.) using the Medusa JS SDK. These are server-only (`"server-only"` import).
- **`src/lib/hooks/`** — Client-side React hooks (`use-in-view`, `use-toggle-state`)
- **`src/lib/config.ts`** — Medusa SDK client initialization, adds `x-medusa-locale` header to all requests
- **`src/modules/`** — UI component modules organized by feature (account, cart, checkout, products, common, layout, etc.)

## Environment Variables

Backend (`.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` — CORS origins
- `JWT_SECRET`, `COOKIE_SECRET`

Storefront (`.env.local`):
- `MEDUSA_BACKEND_URL` — Backend URL (defaults to `http://localhost:9000`)
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` — Medusa publishable API key
- `NEXT_PUBLIC_DEFAULT_REGION` — Default region code (defaults to `us`)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — Razorpay key ID (for online card / UPI / wallet payments)
