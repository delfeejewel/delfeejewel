import crypto from "crypto"

import { APP_SECRET } from "./app-secret"

/**
 * Self-contained signed token for the guest "Track your order" email link.
 *
 * A stateless HMAC token (body.signature, both base64url) proving the holder
 * received the order-confirmation email for a specific order + email. Lets the
 * /track-order page open the order directly without re-typing the email.
 *
 * No external dependency — Node's crypto only. Signed with JWT_SECRET so it
 * shares the app's existing secret rotation.
 */

const SECRET = APP_SECRET
const TTL_MS = 1000 * 60 * 60 * 24 * 60 // 60 days

export type TrackTokenPayload = {
  order_id: string
  email: string
}

function sign(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("base64url")
}

export function signTrackToken(payload: TrackTokenPayload): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + TTL_MS })
  ).toString("base64url")
  return `${body}.${sign(body)}`
}

export function verifyTrackToken(token?: string): TrackTokenPayload | null {
  if (!token || !token.includes(".")) return null
  const [body, sig] = token.split(".")
  if (!body || !sig) return null

  const expected = sign(body)
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return null
  }

  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
    if (!data?.exp || Date.now() > data.exp) return null
    if (!data?.order_id || !data?.email) return null
    return { order_id: data.order_id, email: data.email }
  } catch {
    return null
  }
}
