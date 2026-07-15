import crypto from "crypto"

import { APP_SECRET } from "./app-secret"

/**
 * Helpers for the email-OTP confirmation flow. Codes are never stored in
 * plaintext — only an HMAC hash (peppered with JWT_SECRET) is persisted, and
 * comparison is constant-time.
 */

const PEPPER = APP_SECRET

export const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
export const OTP_MAX_ATTEMPTS = 5 // wrong-code attempts per issued code
export const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000
export const OTP_MAX_REQUESTS_PER_WINDOW = 3 // codes a single email can request per window

/** Cryptographically random, zero-padded 6-digit code. */
export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")
}

export function hashOtpCode(code: string): string {
  return crypto.createHmac("sha256", PEPPER).update(code).digest("hex")
}

export function verifyOtpHash(code: string, hash: string): boolean {
  const a = Buffer.from(hashOtpCode(code))
  const b = Buffer.from(hash)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
