import crypto from "crypto"

import { APP_SECRET } from "./app-secret"

/**
 * Self-contained signed token for one-click newsletter unsubscribe links.
 *
 * Mirrors track-token.ts: a stateless HMAC (body.signature, both base64url)
 * over the subscriber's email, so the public unsubscribe route can act without
 * a login. No external dependency — Node crypto, signed with JWT_SECRET.
 *
 * Long-lived (1 year): an unsubscribe link in an old email must still work.
 */

const SECRET = APP_SECRET
const TTL_MS = 1000 * 60 * 60 * 24 * 365 // 1 year

function sign(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("base64url")
}

export function signUnsubscribeToken(email: string): string {
  const body = Buffer.from(
    JSON.stringify({ email: email.toLowerCase().trim(), exp: Date.now() + TTL_MS })
  ).toString("base64url")
  return `${body}.${sign(body)}`
}

export function verifyUnsubscribeToken(token?: string): { email: string } | null {
  if (!token || !token.includes(".")) return null
  const [body, sig] = token.split(".")
  if (!body || !sig) return null

  const expected = sign(body)
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
    if (!data?.exp || Date.now() > data.exp) return null
    if (!data?.email) return null
    return { email: data.email }
  } catch {
    return null
  }
}
