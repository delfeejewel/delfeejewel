import { randomBytes } from "crypto"

import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { QR_CODE_MODULE } from "../modules/qr_code"

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ" // no 0/O/1/I

function generateCode(): string {
  const buf = randomBytes(8)
  let s = ""
  for (let i = 0; i < 8; i++) s += ALPHABET[buf[i] % ALPHABET.length]
  return `${s.slice(0, 4)}-${s.slice(4, 8)}`
}

/**
 * Seeds a QR code for every product variant that doesn't have one yet.
 * Idempotent — safe to re-run after adding new products.
 *
 * Run with: npx medusa exec ./src/scripts/seed-qr-codes.ts
 */
export default async function seedQrCodes({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const qrModule: any = container.resolve(QR_CODE_MODULE)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "product.id"],
  })
  const variantList = (variants as any[]) || []

  const existing = await qrModule.listQrCodes({})
  const existingByVariant = new Map<string, any>(
    (existing || []).map((qc: any) => [qc.variant_id, qc])
  )

  // Quick existing-code set for collision avoidance
  const existingCodes = new Set<string>(
    (existing || []).map((qc: any) => qc.code)
  )

  let created = 0
  let skipped = 0

  const toCreate: any[] = []
  for (const v of variantList) {
    if (existingByVariant.has(v.id)) {
      skipped++
      continue
    }
    let code = generateCode()
    while (existingCodes.has(code)) code = generateCode()
    existingCodes.add(code)
    toCreate.push({
      code,
      variant_id: v.id,
      product_id: v.product?.id || null,
      sku: v.sku || null,
      status: "active",
    })
  }

  if (toCreate.length) {
    await qrModule.createQrCodes(toCreate)
    created = toCreate.length
  }

  logger.info(
    `QR codes: created ${created}, skipped ${skipped} (already had codes)`
  )
}
