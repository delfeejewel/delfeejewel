import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test"
import { ADMIN_BASE_URL } from "../playwright.config"
import { assertNotProd } from "./helpers"

/**
 * Admin RBAC matrix — every role against every permission-gated endpoint.
 *
 * Setup (local):
 *   for r in developer admin ops marketing viewer employee; do
 *     ./e2e-local.sh npx medusa user -e "e2e-$r@example.com" -p e2elocalpass123
 *   done
 *   ./e2e-local.sh npx medusa exec ./src/scripts/seed-rbac-users.ts
 *
 * How the probes work: each hits a gated endpoint with a deliberately invalid
 * or nonexistent id, so a permitted call fails harmlessly on validation
 * (400/404) instead of mutating anything. The assertion is therefore:
 *
 *   denied  => exactly 403
 *   allowed => anything BUT 403
 *
 * That keeps the suite non-destructive while still proving enforcement.
 *
 * The expected matrix below is written out by hand rather than imported from
 * backend/src/lib/rbac.ts on purpose: importing would make the test agree with
 * the code by construction and catch nothing. This is the intended policy, so
 * an accidental widening of a role fails here.
 */

const PASSWORD = process.env.E2E_RBAC_PASSWORD || "e2elocalpass123"

type Role = "developer" | "admin" | "ops" | "marketing" | "viewer" | "employee"

const ROLES: Role[] = ["developer", "admin", "ops", "marketing", "viewer", "employee"]

type Perm =
  | "users.manage"
  | "users.write"
  | "products.write"
  | "orders.write"
  | "returns.write"
  | "promotions.write"
  | "giftcards.write"
  | "analytics.read"
  | "customers.read"
  | "inventory.write"
  | "shipping.write"
  | "appointments.write"

const ALL: Perm[] = [
  "users.manage",
  "users.write",
  "products.write",
  "orders.write",
  "returns.write",
  "promotions.write",
  "giftcards.write",
  "analytics.read",
  "customers.read",
  "inventory.write",
  "shipping.write",
  "appointments.write",
]

/** The intended policy. Keep in sync with the product decision, not the code. */
const EXPECTED: Record<Role, Perm[]> = {
  developer: ALL,
  // Admin runs the store but must not manage team members or accounts.
  admin: ALL.filter((p) => p !== "users.manage" && p !== "users.write"),
  ops: [
    "orders.write",
    "returns.write",
    "inventory.write",
    "shipping.write",
    "customers.read",
    "analytics.read",
    "appointments.write",
  ],
  marketing: ["promotions.write", "giftcards.write", "analytics.read", "customers.read"],
  viewer: ["analytics.read", "customers.read"],
  // Warehouse: packing and dispatch only. Nothing else, ever.
  employee: ["shipping.write"],
}

/** One representative gated endpoint per permission. */
const PROBES: { perm: Perm; method: "GET" | "POST"; path: string; body?: any }[] = [
  { perm: "users.manage", method: "POST", path: "/admin/set-role", body: { user_id: "usr_nope", role: "admin" } },
  { perm: "users.write", method: "POST", path: "/admin/users", body: {} },
  { perm: "products.write", method: "POST", path: "/admin/products", body: {} },
  { perm: "orders.write", method: "POST", path: "/admin/orders/order_nope/cancel", body: {} },
  { perm: "returns.write", method: "POST", path: "/admin/return-requests/rr_nope/approve", body: {} },
  { perm: "promotions.write", method: "POST", path: "/admin/coupons", body: {} },
  { perm: "giftcards.write", method: "POST", path: "/admin/gift-cards", body: {} },
  { perm: "inventory.write", method: "POST", path: "/admin/qr-codes", body: {} },
  { perm: "shipping.write", method: "POST", path: "/admin/packing/orders/order_nope/start", body: {} },
  { perm: "appointments.write", method: "POST", path: "/admin/appointments", body: {} },
  { perm: "analytics.read", method: "GET", path: "/admin/analytics" },
  { perm: "customers.read", method: "GET", path: "/admin/customers/segments" },
]

/** Extra gated paths that share a permission, to prove the mapping is broad. */
const EXTRA_PROBES: { perm: Perm; method: "POST"; path: string }[] = [
  { perm: "promotions.write", method: "POST", path: "/admin/newsletter" },
  { perm: "promotions.write", method: "POST", path: "/admin/marketing/campaigns" },
  { perm: "orders.write", method: "POST", path: "/admin/fraud-review" },
]

const tokens: Partial<Record<Role, string>> = {}
let api: APIRequestContext

test.beforeAll(async () => {
  assertNotProd(ADMIN_BASE_URL)
  api = await playwrightRequest.newContext({ baseURL: ADMIN_BASE_URL })

  for (const role of ROLES) {
    const res = await api.post("/auth/user/emailpass", {
      data: { email: `e2e-${role}@example.com`, password: PASSWORD },
    })
    if (res.status() !== 200) {
      throw new Error(
        `Could not log in as ${role} (HTTP ${res.status()}). ` +
          "Seed the RBAC users first — see the header of this file."
      )
    }
    tokens[role] = (await res.json()).token
  }
})

test.afterAll(async () => {
  await api?.dispose()
})

async function call(role: Role, p: { method: "GET" | "POST"; path: string; body?: any }) {
  const opts = {
    headers: { Authorization: `Bearer ${tokens[role]}` },
    ...(p.method === "POST" ? { data: p.body ?? {} } : {}),
    failOnStatusCode: false,
  }
  const res = p.method === "GET" ? await api.get(p.path, opts) : await api.post(p.path, opts)
  return res.status()
}

// ---------------------------------------------------------------------------
// The matrix: every role against every permission
// ---------------------------------------------------------------------------

for (const role of ROLES) {
  test.describe(`role: ${role}`, () => {
    for (const probe of PROBES) {
      const allowed = EXPECTED[role].includes(probe.perm)

      test(`${allowed ? "CAN" : "CANNOT"} ${probe.perm} (${probe.method} ${probe.path})`, async () => {
        const status = await call(role, probe)

        if (allowed) {
          expect(
            status,
            `${role} should hold ${probe.perm}, but was denied by RBAC`
          ).not.toBe(403)
        } else {
          expect(
            status,
            `${role} must NOT hold ${probe.perm} — expected 403, got ${status}. ` +
              "A non-403 here means the endpoint is not enforcing the role."
          ).toBe(403)
        }
      })
    }
  })
}

// ---------------------------------------------------------------------------
// Secondary paths sharing a permission
// ---------------------------------------------------------------------------

test.describe("permission mapping covers every route in its cluster", () => {
  for (const probe of EXTRA_PROBES) {
    for (const role of ROLES) {
      const allowed = EXPECTED[role].includes(probe.perm)
      if (allowed) continue // only the denials are interesting here

      test(`${role} is blocked from ${probe.path}`, async () => {
        expect(await call(role, probe)).toBe(403)
      })
    }
  }
})

// ---------------------------------------------------------------------------
// Privilege escalation
// ---------------------------------------------------------------------------

test.describe("privilege escalation", () => {
  test("a non-developer cannot grant itself the developer role", async () => {
    for (const role of ["admin", "ops", "marketing", "viewer", "employee"] as Role[]) {
      const res = await api.post("/admin/set-role", {
        headers: { Authorization: `Bearer ${tokens[role]}` },
        data: { user_id: "usr_self", role: "developer" },
        failOnStatusCode: false,
      })
      expect(res.status(), `${role} must not be able to assign roles`).toBe(403)
    }
  })

  test("a non-developer cannot delete a team member", async () => {
    // Core Medusa route — the RBAC middleware fails open on these because
    // actor_id isn't populated in the middleware phase, so this is guarded at
    // handler level instead. That makes it exactly the case worth testing.
    for (const role of ["admin", "ops", "marketing", "viewer", "employee"] as Role[]) {
      const res = await api.delete("/admin/users/usr_someone_else", {
        headers: { Authorization: `Bearer ${tokens[role]}` },
        failOnStatusCode: false,
      })
      expect(
        res.status(),
        `${role} must not be able to delete users (got ${res.status()})`
      ).toBe(403)
    }
  })

  test("an employee is confined to dispatch and nothing else", async () => {
    // The tightest role: prove the blast radius directly rather than trusting
    // the matrix above to have covered everything.
    const denied = PROBES.filter((p) => p.perm !== "shipping.write")
    for (const probe of denied) {
      expect(
        await call("employee", probe),
        `employee reached ${probe.path}`
      ).toBe(403)
    }
    expect(await call("employee", PROBES.find((p) => p.perm === "shipping.write")!)).not.toBe(403)
  })
})

// ---------------------------------------------------------------------------
// Authentication boundary
// ---------------------------------------------------------------------------

test.describe("authentication boundary", () => {
  test("no token is rejected everywhere", async () => {
    const anon = await playwrightRequest.newContext({ baseURL: ADMIN_BASE_URL })
    for (const probe of PROBES) {
      const res =
        probe.method === "GET"
          ? await anon.get(probe.path, { failOnStatusCode: false })
          : await anon.post(probe.path, { data: probe.body ?? {}, failOnStatusCode: false })
      expect([401, 403], `${probe.path} must reject anonymous access`).toContain(res.status())
    }
    await anon.dispose()
  })

  test("a garbage bearer token is rejected", async () => {
    const res = await api.get("/admin/analytics", {
      headers: { Authorization: "Bearer not-a-real-token" },
      failOnStatusCode: false,
    })
    expect([401, 403]).toContain(res.status())
  })

  test("a valid token cannot be used on a different actor type", async () => {
    // An admin token must not be accepted as a customer token on /store.
    const res = await api.get("/store/customers/me", {
      headers: {
        Authorization: `Bearer ${tokens.developer}`,
        "x-publishable-api-key": process.env.LIVE_PUBLISHABLE_KEY || "",
      },
      failOnStatusCode: false,
    })
    expect(res.status(), "admin token must not authenticate as a customer").toBeGreaterThanOrEqual(
      400
    )
  })
})
