import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createClient } from "@supabase/supabase-js"
import EmailNotificationService from "../../../modules/email_notification/service"

/**
 * POST /store/email-test
 * Sends a test email to verify the CMS-configured sender works.
 *
 * Gated to CMS *developers*: the caller must pass their Supabase access token
 * as `Authorization: Bearer <token>`. We validate it with the service-role key
 * and require app_metadata/user_metadata role === "developer" — the same role
 * model the CMS uses for the Email Sender page.
 */
async function isCmsDeveloper(req: MedusaRequest): Promise<boolean> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false

  const header = req.headers["authorization"]
  const raw = Array.isArray(header) ? header[0] : header
  const jwt = (raw || "").replace(/^Bearer\s+/i, "").trim()
  if (!jwt) return false

  const supabase = createClient(url, key)
  const { data, error } = await supabase.auth.getUser(jwt)
  if (error || !data?.user) return false

  const role =
    (data.user.app_metadata as any)?.role ||
    (data.user.user_metadata as any)?.role ||
    "admin"
  return role === "developer"
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!(await isCmsDeveloper(req))) {
    return res.status(403).json({ message: "Developer access required" })
  }

  const { to } = (req.body ?? {}) as { to?: string }
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return res
      .status(400)
      .json({ message: "A valid recipient email is required" })
  }

  const emailService = req.scope.resolve(
    "email_notification"
  ) as EmailNotificationService

  const result = await emailService.sendTestEmail(to.trim())
  if (!result.ok) {
    return res.status(result.code || 400).json({ message: result.message })
  }
  return res.json({ success: true, message: result.message })
}
