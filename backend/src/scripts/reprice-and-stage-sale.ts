import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { createPriceListsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Two-step catalogue reprice, so a struck-through price is a price that was
 * genuinely charged.
 *
 *   apply    — raise every published variant's INR price by MULTIPLIER
 *              (rounded to the rupee) and stage a DRAFT sale price list that
 *              brings each variant back to exactly today's price. The sale
 *              shows nothing until it's activated.
 *   activate — turn the sale on for SALE_DAYS days. Only then does the
 *              storefront show ~~new price~~ old price · Save 33%.
 *   revert   — put the pre-uplift prices back (uses the amount stashed in
 *              variant.metadata.price_before_uplift) and delete the draft.
 *   preview  — default; prints what would change and touches nothing.
 *
 * The gap between `apply` and `activate` is the point: the higher price has to
 * actually be in effect for a period, otherwise the "was" price is fictitious
 * and the discount claim is misleading.
 *
 *   npx medusa exec ./src/scripts/reprice-and-stage-sale.ts            # preview
 *   npx medusa exec ./src/scripts/reprice-and-stage-sale.ts apply
 *   npx medusa exec ./src/scripts/reprice-and-stage-sale.ts activate
 *   npx medusa exec ./src/scripts/reprice-and-stage-sale.ts revert
 */

const MULTIPLIER = 1.5
const CURRENCY = "inr"
const SALE_DAYS = 14
const SALE_TITLE = "Launch Sale — 33% off"
const META_KEY = "price_before_uplift"

/**
 * Never reprice these. Add-ons and stored-value products aren't merchandise:
 * the gift-wrap fee is quoted as a fixed "₹50" in the storefront copy, and a
 * ₹1,000 gift card must cost ₹1,000 or it stops being a gift card.
 */
const EXCLUDED_HANDLES = ["gift-wrap"]
const EXCLUDING_METADATA_FLAGS = [
  "is_gift_wrap",
  "is_gift_card",
  "is_service",
  "hidden_from_storefront",
]

const isExcluded = (product: any): boolean => {
  if (EXCLUDED_HANDLES.includes(product.handle)) return true
  const meta = (product.metadata || {}) as Record<string, unknown>
  return EXCLUDING_METADATA_FLAGS.some((flag) => meta[flag] === true)
}

type Row = {
  variantId: string
  label: string
  current: number
  raised: number
  metadata: Record<string, unknown>
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN")

async function loadRows(container: any): Promise<Row[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    filters: { status: "published" },
    fields: [
      "id",
      "title",
      "handle",
      "metadata",
      "variants.id",
      "variants.title",
      "variants.metadata",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    pagination: { take: 1000 },
  })

  const rows: Row[] = []
  let skipped = 0
  for (const p of data || []) {
    if (isExcluded(p)) {
      skipped += (p.variants || []).length
      console.log(`  (skipping ${p.title} — add-on / stored value)`)
      continue
    }
    for (const v of p.variants || []) {
      const price = (v.prices || []).find(
        (x: any) => x.currency_code === CURRENCY
      )
      if (!price) continue
      const current = Number(price.amount)
      if (!Number.isFinite(current) || current <= 0) continue
      rows.push({
        variantId: v.id,
        label: `${p.title} · ${v.title}`,
        current,
        raised: Math.round(current * MULTIPLIER),
        metadata: (v.metadata || {}) as Record<string, unknown>,
      })
    }
  }
  if (skipped) console.log(`  ${skipped} excluded variant(s) will not be touched.\n`)
  return rows
}

/** The price to restore on revert / to sell at during the sale. */
const baselineOf = (r: Row): number => {
  const stashed = Number(r.metadata?.[META_KEY])
  return Number.isFinite(stashed) && stashed > 0 ? stashed : r.current
}

export default async function repriceAndStageSale({ container, args }: any) {
  const mode = (args?.[0] || "preview").toLowerCase()
  const pricing: any = container.resolve("pricing")
  const rows = await loadRows(container)

  if (!rows.length) {
    console.log("No published variants with an INR price. Nothing to do.")
    return
  }

  const alreadyRaised = rows.filter((r) => r.metadata?.[META_KEY] != null)
  const [existing] = await pricing.listPriceLists({ title: SALE_TITLE })

  // ─── preview ────────────────────────────────────────────
  if (mode === "preview") {
    console.log(
      `${rows.length} published variants with an ${CURRENCY.toUpperCase()} price.`
    )
    console.log(
      `Uplift ×${MULTIPLIER}, then a ${SALE_DAYS}-day sale back to today's price.\n`
    )
    for (const r of rows.slice(0, 8)) {
      console.log(
        `  ${r.label.padEnd(46).slice(0, 46)} ${inr(r.current).padStart(9)}  →  base ${inr(
          r.raised
        ).padStart(9)}   sale ${inr(baselineOf(r)).padStart(9)}`
      )
    }
    if (rows.length > 8) console.log(`  … and ${rows.length - 8} more`)
    console.log(
      `\nAlready uplifted: ${alreadyRaised.length}. Existing "${SALE_TITLE}": ${
        existing ? existing.status : "none"
      }.`
    )
    console.log("\nNothing changed. Re-run with `apply` to make it real.")
    return
  }

  // ─── revert ─────────────────────────────────────────────
  if (mode === "revert") {
    if (!alreadyRaised.length) {
      console.log("No variants carry a stashed pre-uplift price. Nothing to revert.")
    } else {
      await updateProductVariantsWorkflow(container).run({
        input: {
          product_variants: alreadyRaised.map((r) => ({
            id: r.variantId,
            prices: [{ amount: baselineOf(r), currency_code: CURRENCY }],
            metadata: { ...r.metadata, [META_KEY]: null },
          })),
        },
      })
      console.log(`Restored pre-uplift prices on ${alreadyRaised.length} variants.`)
    }
    if (existing) {
      await pricing.deletePriceLists([existing.id])
      console.log(`Deleted price list "${SALE_TITLE}".`)
    }
    return
  }

  // ─── activate ───────────────────────────────────────────
  if (mode === "activate") {
    if (!existing) {
      console.log(`No "${SALE_TITLE}" price list found. Run \`apply\` first.`)
      return
    }
    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + SALE_DAYS * 86400000)
    await pricing.updatePriceLists([
      {
        id: existing.id,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      },
    ])
    console.log(
      `Sale is LIVE until ${endsAt.toDateString()} — strikethrough now shows storewide.`
    )
    return
  }

  if (mode !== "apply") {
    console.log(`Unknown mode "${mode}". Use preview | apply | activate | revert.`)
    return
  }

  // ─── apply ──────────────────────────────────────────────
  const toRaise = rows.filter((r) => r.metadata?.[META_KEY] == null)

  if (!toRaise.length) {
    console.log("Every variant is already uplifted — skipping the price rise.")
  } else {
    // Stash the current amount so `revert` is exact, not a division.
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: toRaise.map((r) => ({
          id: r.variantId,
          prices: [{ amount: r.raised, currency_code: CURRENCY }],
          metadata: { ...r.metadata, [META_KEY]: r.current },
        })),
      },
    })
    console.log(
      `Raised ${toRaise.length} variants ×${MULTIPLIER} (pre-uplift price stashed).`
    )
  }

  if (existing) {
    console.log(
      `Price list "${SALE_TITLE}" already exists (${existing.status}) — leaving it alone.`
    )
    return
  }

  // Draft, and deliberately with no dates: the window starts when `activate`
  // runs, not when the catalogue was repriced.
  const { result } = await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: SALE_TITLE,
          description: `${Math.round(
            (1 - 1 / MULTIPLIER) * 100
          )}% off for ${SALE_DAYS} days. Returns each variant to its pre-uplift price.`,
          status: "draft",
          type: "sale",
          prices: rows.map((r) => ({
            variant_id: r.variantId,
            amount: baselineOf(r),
            currency_code: CURRENCY,
          })),
        } as any,
      ],
    },
  })

  const list = Array.isArray(result) ? result[0] : result
  console.log(
    `Staged DRAFT price list "${SALE_TITLE}" (${list?.id}) covering ${rows.length} variants.`
  )
  console.log("Nothing is discounted yet. Run `activate` when you're ready.")
}
