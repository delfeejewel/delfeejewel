import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { OTP_MODULE } from "../../../../../modules/otp_verification"
import { verifyOtpHash, OTP_MAX_ATTEMPTS } from "../../../../../utils/otp"

/**
 * POST /store/account/reset-password/confirm
 * Verifies the emailed OTP and sets a new password on the emailpass auth
 * identity. Mirrors the create-verified OTP checks (expiry, attempt cap,
 * constant-time compare). Does not sign the user in — the storefront sends
 * them back to the login form.
 *
 * Body: { email, code, password }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email, code, password } = (req.body || {}) as Record<string, string>

  if (!email || !code || !password) {
    return res
      .status(400)
      .json({ message: "Email, code and a new password are required." })
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

  // ── 2. Require a registered account for this email ─────
  // A reset code is only ever issued for a real account, but re-check here so a
  // stray code can never touch a non-account email.
  const existing = await customerModule.listCustomers({ email: normalized })
  if (!existing.some((c: any) => c.has_account)) {
    return res
      .status(400)
      .json({ message: "Your code has expired. Please request a new one." })
  }

  // ── 3. Update the emailpass password ───────────────────
  const result = await authModule.updateProvider("emailpass", {
    entity_id: normalized,
    password,
  })
  if (!result.success) {
    return res.status(400).json({
      message: "We couldn't reset your password. Please request a new code.",
    })
  }

  // Consume the code only after a successful update so a transient failure
  // doesn't burn the user's code.
  await otpModule.updateOtpCodes([{ id: candidate.id, consumed_at: new Date() }])

  return res.json({ success: true })
}
