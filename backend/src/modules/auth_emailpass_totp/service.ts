import { EmailPassAuthService } from "@medusajs/auth-emailpass/dist/services/emailpass"
import {
  AuthIdentityProviderService,
  AuthenticationInput,
  AuthenticationResponse,
} from "@medusajs/framework/types"

import { verifyTotp, consumeBackupCode } from "../../lib/totp"
import { rateLimit } from "../../utils/rate-limit"
import { TWO_FACTOR_PROVIDER } from "../../lib/two-factor"

/**
 * Two-factor emailpass provider. Registered under the id `emailpass` so it
 * transparently REPLACES the stock provider for both admin and customer logins.
 *
 * It defers entirely to the stock provider for the password check, then adds a
 * TOTP gate that fires ONLY when the identity has 2FA enabled
 * (`provider_metadata.totp_enabled`). Non-enrolled users and all customers are
 * unaffected — they authenticate exactly as before.
 *
 * On a missing code for an enrolled user we return the sentinel error
 * `TWO_FACTOR_REQUIRED`, which the login UI detects to reveal the code field.
 */
export default class EmailPassTotpAuthService extends EmailPassAuthService {
  static identifier = "emailpass"

  async authenticate(
    userData: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    // 1) Stock password verification.
    const result = await super.authenticate(userData, authIdentityService)
    if (!result.success || !result.authIdentity) {
      return result
    }

    // 2) Pull this provider's metadata off the verified identity.
    const email = (userData.body?.email as string) || ""
    const pi = result.authIdentity.provider_identities?.find(
      (p: any) => p.provider === TWO_FACTOR_PROVIDER
    )
    const meta = (pi?.provider_metadata as Record<string, any>) || {}

    // Not enrolled → behave exactly like stock emailpass.
    if (!meta.totp_enabled || !meta.totp_secret) {
      return result
    }

    const totp = (userData.body?.totp as string)?.trim()
    const backupCode = (userData.body?.backup_code as string)?.trim()

    // 3) Enrolled but no second factor supplied → ask the UI for one.
    if (!totp && !backupCode) {
      return {
        success: false,
        error: "TWO_FACTOR_REQUIRED",
      }
    }

    // Throttle second-factor guessing. The password already verified above, so
    // this only limits an attacker (or a stolen password) brute-forcing the
    // 6-digit code / backup codes: 5 attempts per 5 minutes per account.
    const rl = rateLimit(`totp:${email.toLowerCase()}`, 5, 5 * 60_000)
    if (!rl.allowed) {
      return {
        success: false,
        error: "Too many two-factor attempts. Please wait a few minutes and try again.",
      }
    }

    // 4a) TOTP path.
    if (totp) {
      if (verifyTotp(totp, meta.totp_secret)) {
        return result
      }
      return { success: false, error: "Invalid two-factor code" }
    }

    // 4b) Backup-code path — single use, so persist the consumed list.
    const hashes: string[] = Array.isArray(meta.totp_backup_codes)
      ? meta.totp_backup_codes
      : []
    const { ok, remaining } = consumeBackupCode(backupCode, hashes)
    if (!ok) {
      return { success: false, error: "Invalid two-factor code" }
    }
    try {
      // Re-read fresh metadata (which still holds the password hash) and write
      // back the reduced backup-code list, preserving every other key.
      const fresh = await authIdentityService.retrieve({ entity_id: email })
      const freshPi = fresh.provider_identities?.find(
        (p: any) => p.provider === TWO_FACTOR_PROVIDER
      )
      const freshMeta = (freshPi?.provider_metadata as Record<string, any>) || {}
      await authIdentityService.update(email, {
        provider_metadata: { ...freshMeta, totp_backup_codes: remaining },
      })
    } catch {
      // If we can't persist the consumption, still let the user in — failing
      // their login over a bookkeeping write would be worse. The code stays
      // valid until the next successful write.
    }
    return result
  }
}
