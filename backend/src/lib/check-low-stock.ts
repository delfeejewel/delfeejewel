import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

export type LowStockItem = {
  product_title: string
  variant_title: string
  sku: string | null
  available: number
  location: string
}

export type LowStockResult = {
  threshold: number
  low: LowStockItem[]
  emailed_to: string | null
}

/**
 * Scan inventory for variants at or below the low-stock threshold and (when
 * email is configured) send the admin a digest. Reusable from the scheduled
 * job and the manual admin endpoint.
 */
export async function checkLowStock(
  container: MedusaContainer,
  opts?: { threshold?: number; emailTo?: string; sendEmail?: boolean }
): Promise<LowStockResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const stockLocationModule: any = container.resolve(Modules.STOCK_LOCATION)
  const emailService: any = container.resolve("email_notification")

  const envThreshold = Number(process.env.LOW_STOCK_THRESHOLD)
  const threshold =
    opts?.threshold ?? (Number.isFinite(envThreshold) ? envThreshold : 3)

  // Map stock_location id -> name once
  const locations = (await stockLocationModule.listStockLocations({})) || []
  const locationName = new Map<string, string>(
    locations.map((l: any) => [l.id, l.name || l.id])
  )

  // Pull inventory items with their levels and back-linked variants
  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: [
      "id",
      "sku",
      "title",
      "location_levels.location_id",
      "location_levels.stocked_quantity",
      "location_levels.reserved_quantity",
      "variants.title",
      "variants.sku",
      "variants.product.title",
    ],
  })

  const low: LowStockItem[] = []
  for (const ii of (items as any[]) || []) {
    const levels = ii?.location_levels || []
    if (!levels.length) continue
    const variant = (ii?.variants && ii.variants[0]) || null
    const productTitle = variant?.product?.title || ii?.title || "Unknown product"
    const variantTitle = variant?.title || "Default"
    const sku = ii?.sku || variant?.sku || null
    for (const lvl of levels) {
      const stocked = Number(lvl.stocked_quantity || 0)
      const reserved = Number(lvl.reserved_quantity || 0)
      const available = Math.max(0, stocked - reserved)
      if (available <= threshold) {
        low.push({
          product_title: productTitle,
          variant_title: variantTitle,
          sku,
          available,
          location:
            locationName.get(String(lvl.location_id)) ||
            String(lvl.location_id || "—"),
        })
      }
    }
  }

  // Sort: lowest first, then by product title
  low.sort(
    (a, b) =>
      a.available - b.available ||
      a.product_title.localeCompare(b.product_title)
  )

  logger.info(
    `Low-stock check: ${low.length} variant(s) at or below ${threshold} units`
  )

  const send = opts?.sendEmail !== false
  const adminEmail =
    opts?.emailTo ||
    process.env.LOW_STOCK_ADMIN_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.RTO_ADMIN_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.EMAIL_GMAIL_USER ||
    null

  let emailedTo: string | null = null
  if (send && low.length && adminEmail) {
    await emailService.sendLowStockDigest({
      to: adminEmail,
      threshold,
      items: low,
      brand_name: process.env.BRAND_NAME || "Delfee",
    })
    emailedTo = adminEmail
  }

  return { threshold, low, emailed_to: emailedTo }
}
