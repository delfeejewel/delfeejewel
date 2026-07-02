import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Shared read/write of an admin user's two-factor state, which lives in the
 * emailpass provider_identity's `provider_metadata` (alongside the password
 * hash). The custom auth provider reads it natively at login; the admin routes
 * and the CLI write it through here so the merge logic — crucially, never
 * clobbering the password — lives in exactly one place.
 */

// The provider id the admin authenticates against. We register our TOTP
// subclass under this same id so it transparently replaces stock emailpass.
export const TWO_FACTOR_PROVIDER = "emailpass"

export type TwoFactorState = {
  enabled: boolean
  /** active TOTP secret (present once enabled) */
  secret?: string
  /** secret staged during enrolment, before the first code is confirmed */
  pendingSecret?: string
  /** SHA-256 hashes of unused backup codes */
  backupHashes: string[]
  enrolledAt?: string
}

/** The provider_metadata keys we own. Everything else (password) is preserved. */
type TwoFactorMeta = {
  totp_enabled?: boolean
  totp_secret?: string
  totp_pending_secret?: string
  totp_backup_codes?: string[]
  totp_enrolled_at?: string
}

/** Resolve a user's login email from their id (req.auth_context.actor_id). */
export async function emailForUser(
  container: MedusaContainer,
  userId: string
): Promise<string | null> {
  const userModule: any = container.resolve(Modules.USER)
  const users = await userModule.listUsers({ id: userId })
  return users?.[0]?.email ?? null
}

async function getProviderIdentity(container: MedusaContainer, email: string) {
  const auth: any = container.resolve(Modules.AUTH)
  const rows = await auth.listProviderIdentities({
    entity_id: email,
    provider: TWO_FACTOR_PROVIDER,
  })
  return rows?.[0] ?? null
}

function stateFromMeta(meta: TwoFactorMeta | null | undefined): TwoFactorState {
  const m = meta || {}
  return {
    enabled: !!m.totp_enabled,
    secret: m.totp_secret,
    pendingSecret: m.totp_pending_secret,
    backupHashes: Array.isArray(m.totp_backup_codes) ? m.totp_backup_codes : [],
    enrolledAt: m.totp_enrolled_at,
  }
}

/** Read 2FA state by email. Returns a disabled state if no identity exists. */
export async function readTwoFactorByEmail(
  container: MedusaContainer,
  email: string
): Promise<TwoFactorState> {
  const pi = await getProviderIdentity(container, email)
  return stateFromMeta(pi?.provider_metadata as TwoFactorMeta)
}

/** Read 2FA state by user id. */
export async function readTwoFactorByUser(
  container: MedusaContainer,
  userId: string
): Promise<TwoFactorState> {
  const email = await emailForUser(container, userId)
  if (!email) return { enabled: false, backupHashes: [] }
  return readTwoFactorByEmail(container, email)
}

/**
 * Write a patch of our TOTP keys into provider_metadata. Medusa SHALLOW-MERGES
 * this JSON column — omitted keys are left untouched (which is how the password
 * hash survives), so to CLEAR a key you must write an explicit falsy value, not
 * omit it. We therefore normalize `undefined` → `null` so a clear actually
 * overrides the stored value rather than being a no-op.
 */
export async function writeTwoFactorByEmail(
  container: MedusaContainer,
  email: string,
  patch: Partial<TwoFactorMeta>
): Promise<void> {
  const auth: any = container.resolve(Modules.AUTH)
  const pi = await getProviderIdentity(container, email)
  if (!pi) {
    throw new Error(`No emailpass identity for ${email}`)
  }
  const normalized: Record<string, any> = {}
  for (const k of Object.keys(patch)) {
    const v = patch[k as keyof TwoFactorMeta]
    normalized[k] = v === undefined ? null : v
  }
  await auth.updateProviderIdentities({
    id: pi.id,
    provider_metadata: normalized,
  })
}

/** Fully clear 2FA for a user (disable + wipe secrets/backup codes). */
export async function clearTwoFactorByEmail(
  container: MedusaContainer,
  email: string
): Promise<void> {
  await writeTwoFactorByEmail(container, email, {
    totp_enabled: false,
    totp_secret: null as any,
    totp_pending_secret: null as any,
    totp_backup_codes: [],
    totp_enrolled_at: null as any,
  })
}
