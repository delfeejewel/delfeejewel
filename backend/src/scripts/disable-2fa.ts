import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { readTwoFactorByEmail, clearTwoFactorByEmail } from "../lib/two-factor"

/**
 * Break-glass: disable an admin user's two-factor auth from the server when
 * they're fully locked out (lost authenticator AND backup codes, and no other
 * developer is available to reset it from the UI).
 *
 *   npx medusa exec ./src/scripts/disable-2fa.ts <email>
 *
 * Requires server/DB access — that IS the security control here.
 */
export default async function disableTwoFactor({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const email = (args?.[0] || "").trim().toLowerCase()

  if (!email) {
    logger.error("Usage: medusa exec ./src/scripts/disable-2fa.ts <email>")
    return
  }

  const state = await readTwoFactorByEmail(container, email)
  if (!state.enabled && !state.pendingSecret) {
    logger.info(`2FA is not enabled for ${email}; nothing to do.`)
    return
  }

  await clearTwoFactorByEmail(container, email)
  logger.info(
    `✓ Two-factor authentication disabled for ${email}. They can sign in with just their password and re-enrol from Settings → Security.`
  )
}
