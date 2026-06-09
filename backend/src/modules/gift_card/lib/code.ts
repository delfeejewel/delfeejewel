import { randomBytes } from "crypto"

/** Default validity for a freshly issued gift card. */
export const EXPIRY_DAYS = 365

// Unambiguous alphabet — no 0/O/1/I so codes are easy to read off an email.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

/**
 * Generates a human-friendly gift card code in the form XXXX-XXXX-XXXX.
 * Shared by the order.placed subscriber (purchase flow) and the admin
 * "issue gift card" route so both produce identical-looking codes.
 */
export function generateGiftCardCode(): string {
  const buf = randomBytes(12)
  let code = ""
  for (let i = 0; i < 12; i++) {
    code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
}

/** Returns the expiry Date for a card issued now (now + EXPIRY_DAYS). */
export function defaultExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + EXPIRY_DAYS * 86400_000)
}
