import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { actorHasPermission } from "../../../../lib/rbac"
import { resolveShiprocketProvider } from "../../../../lib/shiprocket-provider"
import {
  evaluateWalletGate,
  setWalletOverride,
} from "../../../../lib/shiprocket-wallet"

/**
 * GET  /admin/shiprocket/wallet          → balance + whether assignment is allowed
 * GET  /admin/shiprocket/wallet?force=true → skip the 60s cache
 * POST /admin/shiprocket/wallet          → { override: boolean }
 *
 * Assigning an AWB is paid from the Shiprocket wallet, and an attempt can be
 * charged even when it fails. So the balance is read here and the button is
 * disabled BEFORE the spend rather than after a packer has clicked it six times.
 *
 * The two-threshold behaviour (disable under ₹150, re-enable only past ₹500)
 * lives in lib/shiprocket-wallet so this route and the assignment guard cannot
 * drift apart.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const provider: any = resolveShiprocketProvider(req.scope)
  const force = String(req.query.force || "") === "true"

  const balance = await provider?.getWalletBalance?.(force)
  const gate = await evaluateWalletGate(req.scope, balance ?? null)

  return res.json(gate)
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const { override } = (req.body || {}) as { override?: boolean }
  if (typeof override !== "boolean") {
    return res.status(400).json({ message: "override (boolean) is required" })
  }

  await setWalletOverride(req.scope, {
    active: override,
    at: new Date().toISOString(),
    actor_id: (req as any).auth_context?.actor_id ?? null,
    actor_email: (req as any).auth_context?.app_metadata?.email ?? null,
  })

  // Re-read so the caller gets the resulting gate, not just an ack.
  const provider: any = resolveShiprocketProvider(req.scope)
  const balance = await provider?.getWalletBalance?.()
  const gate = await evaluateWalletGate(req.scope, balance ?? null)

  return res.json({ ok: true, ...gate })
}
