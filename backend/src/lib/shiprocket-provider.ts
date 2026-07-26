import { Modules } from "@medusajs/framework/utils"

/**
 * `req.scope.resolve("fp_shiprocket_shiprocket")` looks correct but is NOT
 * reachable from an admin route — the fulfillment module keeps provider
 * instances in its own container, separate from the app-wide one `req.scope`
 * resolves against. The only way in from outside the module is through the
 * Fulfillment module service's own provider-registration lookup (the same
 * path Medusa's own core-flows steps use internally).
 */
export function resolveShiprocketProvider(scope: any): any {
  const fulfillmentModule: any = scope.resolve(Modules.FULFILLMENT)
  return fulfillmentModule.fulfillmentProviderService_.retrieveProviderRegistration(
    "shiprocket_shiprocket"
  )
}
