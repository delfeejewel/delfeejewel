/** The only real COD provider is the custom `cod` module, registered in
 *  medusa-config.ts as provider id "cod" (giving payment id `pp_cod_cod`).
 *  Anything else (e.g. Razorpay, or Medusa's built-in pp_system_default) is
 *  treated as prepaid. Shared by fraud-context.ts, modules/shiprocket/service.ts,
 *  and utils/build-invoice-data.ts so COD detection can't drift between them
 *  the way it once did (an older broad "manual"/"system" substring match also
 *  caught pp_system_default). */
export function isCodProvider(providerId?: string | null): boolean {
  return (providerId || "").toLowerCase().includes("cod")
}
