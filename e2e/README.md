# Delfee E2E

Five things live here:

- **`resilience.spec.ts`** (default, repeatable, no order placed) — the
  real-world failure cases: wrong item added, wrong quantity, typos in the
  address form, a dropped connection mid-action, double-tapped buttons, Back
  navigation, and hostile URLs. Places no orders and moves no money, so it's
  the cheapest suite to run often. 16 tests.
- **`stock-and-concurrency.spec.ts`** (repeatable, mutates stock) — stock
  races (stepper capped by real stock, low-stock warning, sold-out product,
  selling out while in the cart) and multi-tab concurrency on one cart. Restores
  stock in `afterAll`. 8 tests.
- **`edge-cases.spec.ts`** (repeatable, read-only) — bad URLs, search typos,
  injected markup, oversized/unicode input, account-enumeration safety, and
  API-level auth guarantees. 18 tests.
- **`admin-resilience.spec.ts`** (repeatable) — warehouse operator error:
  cancelling a destructive prompt, the guarantee that an AWB can't be assigned
  while any item is unpacked, and two operators packing one order at once.
  Needs an unpacked seeded order (`E2E_ORDER_DISPLAY_ID`). 4 tests.

- **`full-order-flow.spec.ts`** (default, repeatable, Playwright) — drives the
  real storefront + admin UI end to end against **staging**: browse → cart →
  checkout → Razorpay (test mode) payment → confirmation → admin packing →
  AWB assignment (simulated) → ready-to-ship → shipped → delivered
  (synthesized). Safe to run as often as you like.
- **`live-smoke-test.spec.ts`** (manual-only, real money, Playwright) — a
  human-driven, occasional browser check of the real live checkout UI
  including real Razorpay card entry. See its section below.
- **`live-weekly-smoke.ts`** (scheduled, real money, no browser) — the
  automated weekly check against **live**, wired into GitHub Actions. See its
  section below — read it before touching anything related to it, since it's
  the one that runs unattended and moves real money every week.

`full-order-flow.spec.ts` must **never** run against production.
`tests/helpers.ts` hard-fails if the storefront/admin base URLs resolve to a
prod host.

## Running locally (no staging, no DNS, no cloud)

You can run most of the suite against a fully isolated local stack. **Do not
skip the isolation setup** — `backend/.env` points at the LIVE Supabase
database and carries `rzp_live_` keys, so a naive local run drives production.

Two traps make this non-obvious:

1. `node_modules/.bin/medusa` calls `require("dotenv").config()` before
   anything else, loading the live `.env` into `process.env`. dotenv never
   overwrites an existing key, so `medusa-config.ts`'s `loadEnv('test')`
   **cannot** override it — `NODE_ENV=test npx medusa db:migrate` silently
   connects to production. Always go through `backend/e2e-local.sh`, which
   exports `.env.test` into the shell (real env vars beat dotenv) and aborts if
   `DATABASE_URL` resolves to Supabase or a live Razorpay key appears.
2. A long-lived `medusa start` from the live `.env` may already own port 9000.
   The e2e stack therefore uses **9010 (backend) / 8010 (storefront)**.

```bash
# one-time
createdb medusa_e2e                                  # local postgres
cd backend
./e2e-local.sh npx medusa db:migrate
./e2e-local.sh npx medusa exec ./src/scripts/seed.ts
./e2e-local.sh npx medusa user -e e2e-admin@example.com -p e2elocalpass123
./e2e-local.sh npx medusa exec ./src/scripts/assign-developer-role.ts

# seed.ts links only pp_system_default to the region, so no payment method
# renders at checkout until you enable them:
#   POST /admin/regions/<id> {"payment_providers":["pp_cod_cod","pp_razorpay_razorpay"]}

# run the stack (two terminals)
cd backend           && ./e2e-local.sh npm run dev
cd backend-storefront && MEDUSA_BACKEND_URL=http://localhost:9010 \
  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<pk from local db> \
  NEXT_PUBLIC_BASE_URL=http://localhost:8010 COMING_SOON_MODE=false \
  npx next dev --turbopack -p 8010

# run the suite
cd e2e
E2E_LOCAL=true STAGING_STOREFRONT_URL=http://localhost:8010 \
STAGING_ADMIN_URL=http://localhost:9010 \
STAGING_ADMIN_EMAIL=e2e-admin@example.com STAGING_ADMIN_PASSWORD=e2elocalpass123 \
STAGING_PRODUCT_HANDLE=gold-solitaire-ring \
npx playwright test
```

`E2E_ORDER_DISPLAY_ID=<n>` skips the checkout test and runs the fulfilment
tests against an existing order (e.g. one from
`./e2e-local.sh npx medusa exec ./src/scripts/seed-order.ts`).

The two resilience suites run fully locally today — no payment credentials
needed, since neither places an order:

```bash
# customer-side: wrong item, typos, bad network, mis-clicks (16 tests)
E2E_LOCAL=true STAGING_STOREFRONT_URL=http://localhost:8010 \
STAGING_ADMIN_URL=http://localhost:9010 STAGING_PRODUCT_HANDLE=gold-solitaire-ring \
npx playwright test resilience.spec.ts

# warehouse-side: needs a freshly seeded, unpacked order (3 tests)
E2E_ORDER_DISPLAY_ID=<n> STAGING_ADMIN_URL=http://localhost:9010 \
STAGING_ADMIN_EMAIL=e2e-admin@example.com STAGING_ADMIN_PASSWORD=e2elocalpass123 \
npx playwright test admin-resilience.spec.ts
```

`admin-resilience.spec.ts` is `serial` and consumes its order's state — seed a
new one for each full run.

All four resilience suites together (46 tests, ~3 min, no payment credentials
needed). Seed a fresh order first and pass its display id:

```bash
cd backend && ./e2e-local.sh npx medusa exec ./src/scripts/seed-order.ts   # note the display id
cd ../e2e
E2E_LOCAL=true E2E_ORDER_DISPLAY_ID=<n> \
STAGING_STOREFRONT_URL=http://localhost:8010 STAGING_ADMIN_URL=http://localhost:9010 \
STAGING_ADMIN_EMAIL=e2e-admin@example.com STAGING_ADMIN_PASSWORD=e2elocalpass123 \
STAGING_PRODUCT_HANDLE=gold-solitaire-ring \
npx playwright test resilience.spec.ts edge-cases.spec.ts \
  stock-and-concurrency.spec.ts admin-resilience.spec.ts --workers=1
```

`--workers=1` matters: the stock suite mutates shared catalogue state, so
parallel workers would fight over inventory.

### Known behaviour these suites pin down

- **Product data is cached for 60s** (`src/lib/data/products.ts`,
  `revalidate: 60`). Stock and price on the storefront can lag reality by up to
  a minute, so a shopper can add a just-sold-out item; Medusa's reservation at
  completion is the authoritative check. The sold-out test works around this by
  using a product zeroed before it is ever viewed.
- **Cart data is cached for 30s** (`retrieveCart`). A tab whose cart was emptied
  elsewhere can still show the old contents for one render; it reconciles on a
  subsequent reload rather than staying wrong forever.

### What a local run can and cannot cover

Verified working locally: browse → variant selection → add to cart → cart →
checkout address step → payment-method selection; and admin login → packing
queue → TEST MODE banner → order drawer → start packing → pack all items.

**Order placement cannot complete locally.** Every payment route needs
credentials or is disabled by design:

| Provider | Why not |
|---|---|
| Razorpay | `checkout.js` has no offline mode; needs real `rzp_test_` keys |
| COD | `src/utils/cod.ts` always requires an upfront token (10%, or flat ₹200 under ₹2000) — collected *through Razorpay* |
| Manual (`pp_system_default`) | deliberately hidden from checkout by `HIDDEN_PROVIDER_PREFIXES` in `src/lib/data/payment.ts` |

Add `rzp_test_` keys to `backend/.env.test` to unblock the checkout leg.

**AWB assignment also can't be exercised by a seeded order**: `seed-order.ts`
creates an order with no shipping method, so packing produces a
`manual_manual` fulfilment and the Shiprocket route 404s. Reaching that code
path needs an order placed through the cart against a shipping option bound to
the shiprocket provider (see `src/scripts/connect-shiprocket.ts`).

## Prerequisites

1. Staging is deployed (`.github/workflows/deploy-staging.yml`) and reachable at
   `https://staging.delfee.in` / `https://api-staging.delfee.in`.
2. The admin Packing page on staging shows the **TEST MODE** banner — this
   proves `SHIPROCKET_SIMULATE=true` is active. The suite refuses to proceed
   past the packing step if this banner isn't visible.
3. A staging admin user exists (create one on the staging backend the same way
   you would on prod — do NOT reuse prod admin credentials here).
4. At least one in-stock, single-region product is seeded on staging; note its
   handle for `STAGING_PRODUCT_HANDLE`.

## Setup

```bash
cd e2e
npm install
npx playwright install chromium
```

## Required env vars

| Var | Example | Notes |
|---|---|---|
| `STAGING_STOREFRONT_URL` | `https://staging.delfee.in` | |
| `STAGING_ADMIN_URL` | `https://api-staging.delfee.in` | |
| `STAGING_ADMIN_EMAIL` | | staging-only admin account |
| `STAGING_ADMIN_PASSWORD` | | |
| `STAGING_PRODUCT_HANDLE` | `kite-earrings` | must exist + be in stock on staging |
| `STAGING_SSH_HOST` | `168.144.24.176` | for the delivery-simulation step only |
| `STAGING_SSH_USER` | `root` | defaults to `root` |

Test order emails are generated per-run as `e2e-staging-<timestamp>@example.com`
— **never** `itservices007ak@gmail.com`, per standing project rule.

## Run

```bash
npx playwright test
```

```bash
npx playwright test --headed   # watch it drive the browser
npm run report                 # open the last HTML report
```

## What it does NOT test

- Real courier pickup/delivery — Shiprocket has no public sandbox, so AWB/
  label/pickup are simulated in-app (`SHIPROCKET_SIMULATE=true`) and the
  terminal "Delivered" tracking event is synthesized via the existing
  `bump-order-status.ts` script run inside the staging container.
- Real money movement — Razorpay test-mode keys only.
- Any production data or account.

---

## `live-smoke-test.spec.ts` — separate, manual-only, real money

A second, deliberately separate spec exists for occasionally verifying the
*real* Shiprocket courier-ranking/AWB logic against the live account. It:

- Places a **real order with a real Razorpay charge** on `delfee.in`.
- Waits for a **human to complete the Razorpay payment by hand** in the opened
  browser window — no card numbers are ever stored in code or env vars.
- Walks admin packing up to **AWB assignment only**, then immediately clicks
  **"Reset Shipment"** to void the AWB at Shiprocket. It never clicks "Ready
  to Ship", which is the step that actually requests a courier pickup — so no
  real courier is ever dispatched.
- Does **not** cancel/refund the order or its payment — that's a manual step
  afterward (Razorpay dashboard + admin), which the test reminds you of.

It refuses to run at all unless you explicitly opt in:

```bash
CONFIRM_LIVE_RUN=I-UNDERSTAND-THIS-CHARGES-REAL-MONEY \
LIVE_PRODUCT_HANDLE=<cheap-real-in-stock-handle> \
LIVE_ADMIN_EMAIL=... LIVE_ADMIN_PASSWORD=... \
npx playwright test live-smoke-test.spec.ts --headed
```

**Never** wire this into CI, a cron job, or anything that runs it more than
once by a human's deliberate choice — every run is a real charge and touches
your real Shiprocket account and order history. Optional `LIVE_TEST_EMAIL` lets
you use your own inbox to see the real confirmation email; if omitted it falls
back to a synthetic `e2e-staging-<timestamp>@example.com` address — never
`itservices007ak@gmail.com`.

---

## `live-weekly-smoke.ts` — scheduled, automated, real money, no browser

This is the one that actually runs on its own, every Monday
(`.github/workflows/live-weekly-smoke.yml`, plus manual `workflow_dispatch`).
Because nothing is watching it, it talks to the production HTTP APIs
directly (not a browser) and only ever charges a **pre-saved Razorpay
token** — no card data lives in this repo, in CI secrets, or in the script.
Every run: creates a cart for the dedicated ₹1 test product → initiates a
Razorpay session the same way real checkout does → charges it server-side via
`POST /admin/automation/live-smoke/charge-and-complete` → assigns a **real**
Shiprocket AWB (proves the courier-ranking logic still works against the real
account) → **immediately voids it** before ever requesting pickup, so no
courier is dispatched → cancels the order, which auto-refunds the ₹1 → checks
the refund actually went through, and fails the whole run loudly if not.

### Dry run first — `LIVE_SMOKE_DRY_RUN=true`

Before letting it charge anything, run it in dry mode. It does steps 1–3 only
(admin login → cart with the ₹1 variant → address → shipping option → Razorpay
payment session) and stops **before** the charge:

```bash
cd e2e && npm run live-smoke:dry   # needs the same env vars as a real run
```

or from the Actions tab: **Run workflow** → the `dry_run` box is **ticked by
default**, so a manual dispatch never charges unless you deliberately untick it.
The weekly cron passes no inputs and therefore always does the real run.

A dry run verifies: admin credentials + `orders.write`, the variant id, that an
India region and a shipping option exist for the cart, that Razorpay session
initiation works, and that live is **not** running with `SHIPROCKET_SIMULATE`
on. It costs ₹0 and creates no order, payment, or fulfillment — it only leaves
an abandoned cart behind, which is indistinguishable from a real shopper
walking away.

It does **not** cover the tokenized charge, real AWB assignment/void, or the
cancel+refund path. Those only happen in a real run.

### One-time setup (do this before enabling anything)

1. **Seed the test product**: `npx medusa exec ./src/scripts/seed-live-smoke-product.ts`
   on the live backend. Note the product id and variant id it prints.
2. **Save a card token**: the admin setup page has been removed from the nav.
   Drive the two setup endpoints directly (`POST /admin/automation/live-smoke/setup/create-order`
   then `.../setup/confirm`, both `orders.write`-gated) to pay ₹1 with a real card
   once. The confirm response returns `RAZORPAY_LIVE_SMOKE_CUSTOMER_ID` /
   `RAZORPAY_LIVE_SMOKE_TOKEN_ID`
   to paste into `/opt/delfee/backend.env`, plus `LIVE_SMOKE_TEST_ENABLED=true`.
   Set `LIVE_SMOKE_TEST_PRODUCT_ID` there too (from step 1). Restart the backend
   for these to take effect.
3. **GitHub Actions secrets** (repo settings → Secrets and variables → Actions):

   | Secret | Notes |
   |---|---|
   | `LIVE_SMOKE_PUBLISHABLE_KEY` | the live store's `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` |
   | `LIVE_SMOKE_TEST_VARIANT_ID` | the variant id from step 1 |
   | `LIVE_SMOKE_TEST_EMAIL` | a dedicated inbox — **never** `itservices007ak@gmail.com` |
   | `LIVE_SMOKE_ADMIN_EMAIL` / `LIVE_SMOKE_ADMIN_PASSWORD` | a real admin account with `orders.write` |

   None of these are card data — they're safe to store as normal CI secrets.

4. Dispatch the workflow **as a dry run** first (see above), then once that's
   green dispatch it again with `dry_run` unticked — a real run, watched —
   before trusting the weekly cron. Watch the Razorpay dashboard for the ₹1
   capture + refund, and the Shiprocket dashboard to confirm the AWB was
   voided and no pickup was ever requested.

### To turn it off

Set `LIVE_SMOKE_TEST_ENABLED` to anything other than `true` (or remove it) in
`backend.env` and restart — the charge route 503s immediately, independent of
whether the GitHub Actions schedule itself is disabled. Disable the workflow
in the Actions tab too if you want it to stop running entirely.
