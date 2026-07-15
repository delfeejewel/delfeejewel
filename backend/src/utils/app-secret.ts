/**
 * The application HMAC secret, shared by OTP hashing, guest order-tracking
 * tokens, and unsubscribe tokens. Backed by JWT_SECRET.
 *
 * Fails HARD in production if JWT_SECRET is unset: the previous
 * `process.env.JWT_SECRET || "supersecret"` fallback silently made every one of
 * those tokens forgeable if the env var was ever missing. In development we
 * fall back to a fixed insecure value with a warning so local work isn't
 * blocked.
 */
function resolveAppSecret(): string {
  const s = process.env.JWT_SECRET
  if (s && s.length > 0) return s

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is not set. Refusing to start in production with an insecure default — set JWT_SECRET."
    )
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[security] JWT_SECRET is not set; using an insecure development fallback. Set JWT_SECRET before deploying."
  )
  return "dev-only-insecure-secret-change-me"
}

export const APP_SECRET = resolveAppSecret()
