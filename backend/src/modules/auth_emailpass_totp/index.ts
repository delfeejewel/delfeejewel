import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import EmailPassTotpAuthService from "./service"

/**
 * Auth provider module wrapping emailpass with a TOTP second factor.
 * Registered in medusa-config under the id `emailpass` so it replaces the
 * stock provider without changing any login URLs.
 */
export default ModuleProvider(Modules.AUTH, {
  services: [EmailPassTotpAuthService],
})
