import crypto from "crypto"
import { authenticator } from "otplib"

/**
 * TOTP + backup-code helpers for admin two-factor auth. Pure/stateless so the
 * auth provider, the admin routes, and the CLI all share one implementation.
 *
 * TOTP uses the otplib defaults (SHA1, 6 digits, 30s period) — the de-facto
 * standard compatible with Google Authenticator, Authy, Microsoft Authenticator,
 * etc. We allow a ±1 step window to tolerate clock drift.
 */

// Accept the current code plus one step on each side (≈±30s of drift).
authenticator.options = { window: 1 }

const ISSUER = process.env.TWO_FACTOR_ISSUER || process.env.BRAND_NAME || "Delfee"

/** Generate a new base32 TOTP secret. */
export function generateTotpSecret(): string {
  return authenticator.generateSecret()
}

/**
 * Build the otpauth:// URI an authenticator app imports (via QR or manual key).
 * `account` is shown in the app — use the admin's email.
 */
export function buildOtpAuthUrl(account: string, secret: string): string {
  return authenticator.keyuri(account, ISSUER, secret)
}

/** Verify a 6-digit TOTP code against a secret (with the drift window). */
export function verifyTotp(token: string, secret: string): boolean {
  if (!token || !secret) return false
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ""), secret })
  } catch {
    return false
  }
}

// ── Backup codes ───────────────────────────────────────────────────────────
// One-time recovery codes shown once at enrolment. Stored only as SHA-256
// hashes; each is consumed on use. (High-entropy random codes → a fast hash is
// appropriate; we are not protecting a low-entropy human password here.)

const BACKUP_CODE_COUNT = 8

/** Format: `abcd-efgh` (lowercase base32, no ambiguous chars). */
function randomBackupCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789" // no i,l,o,0,1
  const pick = () =>
    Array.from(
      { length: 4 },
      () => alphabet[crypto.randomInt(0, alphabet.length)]
    ).join("")
  return `${pick()}-${pick()}`
}

export function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.trim().toLowerCase())
    .digest("hex")
}

/**
 * Generate a fresh set of backup codes. Returns the plaintext (to show the user
 * ONCE) and the hashes (to persist).
 */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): {
  plain: string[]
  hashed: string[]
} {
  const plain = Array.from({ length: count }, () => randomBackupCode())
  return { plain, hashed: plain.map(hashBackupCode) }
}

/**
 * Check a submitted backup code against the stored hashes. If it matches,
 * returns the remaining hashes with that one consumed (removed). If not,
 * returns ok:false and the list unchanged.
 */
export function consumeBackupCode(
  code: string,
  hashed: string[]
): { ok: boolean; remaining: string[] } {
  const h = hashBackupCode(code)
  const idx = (hashed || []).indexOf(h)
  if (idx === -1) return { ok: false, remaining: hashed || [] }
  const remaining = [...hashed]
  remaining.splice(idx, 1)
  return { ok: true, remaining }
}
