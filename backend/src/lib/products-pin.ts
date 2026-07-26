import crypto from "crypto"
import { Modules } from "@medusajs/framework/utils"

/**
 * A single shared 4-digit PIN gates the "employee" role's access to
 * /admin/products*. The hash is persisted on store.metadata.products_pin_hash
 * (same no-migration pattern as lib/feature-flags.ts). Unlocking is per
 * browser session: verify/route.ts sets a signed, httpOnly SESSION cookie (no
 * maxAge, so it clears when the browser/tab closes), with a hard-cap baked
 * into the signed payload as a defense-in-depth backstop.
 */

const SECRET =
  process.env.COOKIE_SECRET || process.env.JWT_SECRET || "products-pin-dev-secret"
const UNLOCK_TTL_MS = 8 * 60 * 60 * 1000 // 8h backstop; the cookie itself is session-scoped

export const PRODUCTS_PIN_COOKIE = "products_pin_unlock"

async function getStore(scope: any) {
  const storeModule = scope.resolve(Modules.STORE)
  const [store] = await storeModule.listStores({}, { take: 1 })
  return { storeModule, store }
}

export function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin.trim()).digest("hex")
}

export async function getProductsPinHash(scope: any): Promise<string | null> {
  const { store } = await getStore(scope)
  return (store?.metadata as any)?.products_pin_hash || null
}

export async function setProductsPinHash(
  scope: any,
  hash: string | null
): Promise<void> {
  const { storeModule, store } = await getStore(scope)
  if (!store) throw new Error("Store record not found")
  await storeModule.updateStores(store.id, {
    metadata: { ...(store.metadata || {}), products_pin_hash: hash },
  })
}

export function signUnlockToken(userId: string): string {
  const expires = Date.now() + UNLOCK_TTL_MS
  const payload = `${userId}.${expires}`
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex")
  return `${payload}.${sig}`
}

export function verifyUnlockToken(
  token: string | undefined,
  userId: string
): boolean {
  if (!token || !userId) return false
  const parts = token.split(".")
  if (parts.length !== 3) return false
  const [tokUserId, expiresStr, sig] = parts
  if (tokUserId !== userId) return false
  const expires = Number(expiresStr)
  if (!expires || Number.isNaN(expires) || Date.now() > expires) return false

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${tokUserId}.${expiresStr}`)
    .digest("hex")
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Reads a cookie without depending on cookie-parser being mounted. */
export function readCookie(req: any, name: string): string | undefined {
  const raw = req?.headers?.cookie
  if (!raw) return undefined
  for (const part of String(raw).split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return undefined
}
