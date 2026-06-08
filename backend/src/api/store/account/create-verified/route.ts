import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
  generateJwtToken,
} from "@medusajs/framework/utils"
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows"
import { OTP_MODULE } from "../../../../modules/otp_verification"
import { verifyOtpHash, OTP_MAX_ATTEMPTS } from "../../../../utils/otp"

const EXISTS_MSG = "An account with this email already exists. Please log in."

/**
 * POST /store/account/create-verified
 * Creates a customer account after confirming the email via OTP, then links any
 * unlinked guest orders placed with that (now verified) email and returns a
 * Medusa customer session token.
 *
 * Body: { email, password, first_name?, last_name?, phone?, code, order_id? }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email, password, first_name, last_name, phone, code } = (req.body ||
    {}) as Record<string, string>

  if (!email || !password || !code) {
    return res
      .status(400)
      .json({ message: "Email, password and verification code are required." })
  }
  if (String(password).length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters." })
  }
  const normalized = String(email).toLowerCase().trim()

  const otpModule: any = req.scope.resolve(OTP_MODULE)
  const authModule = req.scope.resolve(Modules.AUTH)
  const customerModule = req.scope.resolve(Modules.CUSTOMER)
  const orderModule: any = req.scope.resolve(Modules.ORDER)
  const config: any = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE)

  // ── 1. Verify the OTP ──────────────────────────────────
  const codes = await otpModule.listOtpCodes({ email: normalized })
  const candidate = codes
    .filter((c: any) => !c.consumed_at)
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

  if (!candidate || new Date(candidate.expires_at).getTime() < Date.now()) {
    return res
      .status(400)
      .json({ message: "Your code has expired. Please request a new one." })
  }
  if (candidate.attempts >= OTP_MAX_ATTEMPTS) {
    return res.status(400).json({
      message: "Too many incorrect attempts. Please request a new code.",
    })
  }
  if (!verifyOtpHash(String(code).trim(), candidate.code_hash)) {
    await otpModule.updateOtpCodes([
      { id: candidate.id, attempts: candidate.attempts + 1 },
    ])
    return res.status(400).json({ message: "Incorrect code. Please try again." })
  }
  await otpModule.updateOtpCodes([
    { id: candidate.id, consumed_at: new Date() },
  ])

  // ── 2. Reject only if a *registered* account exists ────
  // Guest customers (has_account=false) are created at checkout for every guest
  // order — they must not block sign-up; we re-link their orders in step 5.
  const existing = await customerModule.listCustomers({ email: normalized })
  if (existing.some((c: any) => c.has_account)) {
    return res.status(409).json({ message: EXISTS_MSG })
  }

  // ── 3. Register the auth identity (emailpass) ──────────
  let authIdentity: any
  try {
    const reg = await authModule.register("emailpass", {
      body: { email: normalized, password },
    } as any)
    if (!reg.success || !reg.authIdentity) {
      return res.status(409).json({ message: EXISTS_MSG })
    }
    authIdentity = reg.authIdentity
  } catch {
    return res.status(409).json({ message: EXISTS_MSG })
  }

  // ── 4. Create the customer ─────────────────────────────
  const { result: customer } = await createCustomerAccountWorkflow(
    req.scope
  ).run({
    input: {
      authIdentityId: authIdentity.id,
      customerData: {
        email: normalized,
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        phone: phone || undefined,
      },
    },
  })

  // ── 5. Link every guest order for the verified email ───
  // Guest orders point at a throwaway guest customer (has_account=false), so we
  // re-point ALL of them to the new account — not just the null-customer_id ones.
  let linkedOrders = 0
  try {
    const orders = await orderModule.listOrders({ email: normalized })
    for (const o of orders) {
      if (o.customer_id !== customer.id) {
        await orderModule.updateOrders(o.id, { customer_id: customer.id })
        linkedOrders++
      }
    }
  } catch {
    // Linking is best-effort; the account is still created.
  }

  // ── 6. Mint a customer session token ───────────────────
  const { http } = config.projectConfig
  const token = generateJwtToken(
    {
      actor_id: customer.id,
      actor_type: "customer",
      auth_identity_id: authIdentity.id,
      app_metadata: { customer_id: customer.id, roles: [] },
      user_metadata: {},
    },
    { secret: http.jwtSecret, expiresIn: http.jwtExpiresIn || "7d" }
  )

  return res.json({ token, linked_orders: linkedOrders })
}
