import crypto from "crypto"
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  getProductsPinHash,
  hashPin,
  signUnlockToken,
  PRODUCTS_PIN_COOKIE,
} from "../../../../lib/products-pin"
import { rateLimit, clientIp } from "../../../../utils/rate-limit"

/**
 * POST /admin/products-pin/verify — checks the submitted PIN against the
 * shared hash and, on success, sets the signed session cookie that
 * requireProductsPinForEmployee (middlewares.ts) accepts as unlocked.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const actorId = req.auth_context?.actor_id
  if (!actorId) {
    return res.status(401).json({ message: "Not authenticated." })
  }

  const rl = rateLimit(`products-pin:${actorId}:${clientIp(req)}`, 5, 5 * 60_000)
  if (!rl.allowed) {
    return res.status(429).json({
      message: `Too many attempts. Try again in ${rl.retryAfterSec}s.`,
    })
  }

  const storedHash = await getProductsPinHash(req.scope)
  if (!storedHash) {
    return res.status(400).json({ message: "No PIN has been configured yet." })
  }

  const pin = String((req.body as any)?.pin || "")
  const submittedHash = hashPin(pin)
  const a = Buffer.from(submittedHash)
  const b = Buffer.from(storedHash)
  const match = a.length === b.length && crypto.timingSafeEqual(a, b)
  if (!match) {
    return res.status(401).json({ message: "Incorrect PIN." })
  }

  res.cookie(PRODUCTS_PIN_COOKIE, signUnlockToken(actorId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  return res.json({ unlocked: true })
}
