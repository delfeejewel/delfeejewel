import { Modules } from "@medusajs/framework/utils"

/**
 * Storefront copy + visibility for the coupon codes advertised in the PDP
 * "Offers & Coupons" section (GET /store/promotions).
 *
 *   description        — the explanatory line under "CODE · 20% off". The card
 *                        already renders the value, so this should add terms
 *                        or context, not repeat the number.
 *   hide_on_storefront — never advertise this code publicly. It still works if
 *                        someone types it in; it just isn't listed.
 *
 * Idempotent and metadata-merging (never clobbers other keys), so it's safe to
 * re-run — e.g. after seed-promotions.ts recreates the starter set.
 *
 *   npx medusa exec ./src/scripts/set-coupon-copy.ts
 */

type CouponCopy = {
  description?: string
  hide_on_storefront?: boolean
}

const COPY: Record<string, CouponCopy> = {
  WELCOME20: {
    description: "A warm welcome to Delfee. No minimum spend.",
  },
  SALE15: {
    description: "Seasonal sale saving. Valid until 24 August 2026.",
  },
  FLAT200: {
    description: "Flat discount on your whole order. No minimum spend.",
  },
  SAVE10: {
    description: "Everyday saving on your whole order. No minimum spend.",
  },
  TEST10: {
    description: "10% off your whole order. No minimum spend.",
  },
  // Deep-discount handout code — works when typed, never advertised.
  "DELF99-K7X2QM": {
    hide_on_storefront: true,
  },
}

export default async function setCouponCopy({ container }: any) {
  const promoModule: any = container.resolve(Modules.PROMOTION)

  const codes = Object.keys(COPY)
  const promotions = await promoModule.listPromotions({ code: codes })

  const found = new Set<string>()
  const updates: any[] = []

  for (const promo of promotions || []) {
    found.add(promo.code)
    const copy = COPY[promo.code]
    if (!copy) continue

    // Merge — these promotions also carry flags like `first_order_only`.
    const metadata = { ...(promo.metadata || {}), ...copy }

    const unchanged = Object.entries(copy).every(
      ([k, v]) => (promo.metadata || {})[k] === v
    )
    if (unchanged) {
      console.log(`= ${promo.code} — already up to date`)
      continue
    }

    updates.push({ id: promo.id, metadata })
    console.log(
      `→ ${promo.code} — ${copy.hide_on_storefront ? "hiding from storefront" : "setting description"}`
    )
  }

  for (const code of codes) {
    if (!found.has(code)) console.log(`! ${code} — not found, skipped`)
  }

  if (!updates.length) {
    console.log("Nothing to update.")
    return
  }

  await promoModule.updatePromotions(updates)
  console.log(`Updated ${updates.length} coupon(s).`)
}
