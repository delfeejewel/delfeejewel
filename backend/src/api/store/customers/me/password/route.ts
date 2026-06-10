import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /store/customers/me/password
 * Lets a signed-in customer change their own password. The current password is
 * verified against the emailpass provider first, so a hijacked session alone
 * can't change it. Authenticated by middleware (session|bearer), so
 * req.auth_context.actor_id is the customer id.
 *
 * Body: { old_password, new_password }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id
  if (!actorId) {
    return res.status(401).json({ message: "Not authenticated." })
  }

  const { old_password, new_password } = (req.body || {}) as Record<
    string,
    string
  >
  if (!old_password || !new_password) {
    return res
      .status(400)
      .json({ message: "Current and new password are required." })
  }
  if (String(new_password).length < 8) {
    return res
      .status(400)
      .json({ message: "New password must be at least 8 characters." })
  }

  const authModule = req.scope.resolve(Modules.AUTH)
  const customerModule = req.scope.resolve(Modules.CUSTOMER)

  const customer = await customerModule
    .retrieveCustomer(actorId)
    .catch(() => null)
  if (!customer?.email) {
    return res.status(404).json({ message: "Account not found." })
  }
  const email = customer.email.toLowerCase().trim()

  // Verify the current password before allowing the change.
  const auth = await authModule.authenticate("emailpass", {
    body: { email, password: old_password },
  } as any)
  if (!auth?.success) {
    return res
      .status(400)
      .json({ message: "Your current password is incorrect." })
  }

  const result = await authModule.updateProvider("emailpass", {
    entity_id: email,
    password: new_password,
  })
  if (!result.success) {
    return res.status(400).json({
      message: "We couldn't update your password. Please try again.",
    })
  }

  return res.json({ success: true })
}
