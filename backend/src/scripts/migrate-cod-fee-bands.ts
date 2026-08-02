import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductVariantsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

import { COD_FEE_BANDS } from "../utils/cod"

const HANDLE = "cod-fee"

/**
 * Brings an ALREADY-SEEDED COD Handling Fee product up to the banded structure
 * in utils/cod.ts. seed-cod-fee-product.ts early-returns when the product
 * exists, so it can never do this itself.
 *
 * Reprices/renames the existing variant into the first band and creates the
 * rest. Nothing is deleted: order line items snapshot their own sku/price, so
 * history is unaffected either way, and leaving strays is safer than removing
 * a variant some open cart still references.
 *
 * Idempotent — re-running only fixes whatever drifted.
 *
 *   npx medusa exec ./src/scripts/migrate-cod-fee-bands.ts
 */
export default async function migrateCodFeeBands({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    filters: { handle: HANDLE },
    fields: [
      "id",
      "options.id",
      "options.title",
      "options.values.value",
      "variants.id",
      "variants.sku",
      "variants.title",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
  })
  const product: any = products?.[0]
  if (!product) {
    logger.error(`No "${HANDLE}" product — run seed-cod-fee-product.ts first.`)
    return
  }

  // The "Type" option must offer every band value before variants can use them.
  const typeOption = (product.options || []).find(
    (o: any) => o.title === "Type"
  )
  if (typeOption) {
    const have = new Set(
      (typeOption.values || []).map((v: any) => v.value ?? v)
    )
    const missing = COD_FEE_BANDS.filter((b) => !have.has(b.option))
    if (missing.length) {
      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: product.id },
          update: {
            options: [
              {
                id: typeOption.id,
                title: "Type",
                values: [
                  ...Array.from(have) as string[],
                  ...missing.map((b) => b.option),
                ],
              },
            ],
          },
        } as any,
      })
      logger.info(
        `✔ option "Type" extended with: ${missing.map((b) => b.option).join(", ")}`
      )
    }
  }

  const variants: any[] = product.variants || []
  const bySku = new Map(variants.map((v) => [v.sku, v]))

  for (const [i, band] of COD_FEE_BANDS.entries()) {
    const existing = bySku.get(band.sku)

    if (existing) {
      const price = Number(
        (existing.prices || []).find((p: any) => p.currency_code === "inr")
          ?.amount
      )
      if (price === band.amount) {
        logger.info(`  ${band.sku}: already ₹${band.amount} — skipped`)
        continue
      }
      await updateProductVariantsWorkflow(container).run({
        input: {
          product_variants: [
            {
              id: existing.id,
              prices: [{ amount: band.amount, currency_code: "inr" }],
            },
          ],
        } as any,
      })
      logger.info(`✔ ${band.sku}: repriced ${price} → ₹${band.amount}`)
      continue
    }

    // First band adopts the original single variant (whatever its old SKU),
    // so existing carts holding it keep working and just get the right price.
    const orphan =
      i === 0
        ? variants.find((v) => !COD_FEE_BANDS.some((b) => b.sku === v.sku))
        : undefined

    if (orphan) {
      await updateProductVariantsWorkflow(container).run({
        input: {
          product_variants: [
            {
              id: orphan.id,
              sku: band.sku,
              title: band.option,
              options: { Type: band.option },
              prices: [{ amount: band.amount, currency_code: "inr" }],
            },
          ],
        } as any,
      })
      logger.info(
        `✔ adopted existing variant ${orphan.sku} → ${band.sku} @ ₹${band.amount}`
      )
      continue
    }

    await createProductVariantsWorkflow(container).run({
      input: {
        product_variants: [
          {
            product_id: product.id,
            title: band.option,
            sku: band.sku,
            manage_inventory: false,
            allow_backorder: true,
            metadata: { is_cod_fee: true, cod_fee_band_max: band.max },
            options: { Type: band.option },
            prices: [{ amount: band.amount, currency_code: "inr" }],
          },
        ],
      } as any,
    })
    logger.info(`✔ created ${band.sku} @ ₹${band.amount} (≤ ₹${band.max})`)
  }

  // Converge the flags on every band variant. A `product-variant.created`
  // subscriber races variant creation and can stamp manage_inventory=true with
  // a stock level, which is wrong for a fee that has no inventory: it would
  // decrement phantom stock on every COD order. (allow_backorder saves
  // checkout from actually breaking, which is exactly why this drifts unseen.)
  const { data: after } = await query.graph({
    entity: "product",
    filters: { handle: HANDLE },
    fields: ["variants.id", "variants.sku", "variants.manage_inventory"],
  })
  const managed = ((after?.[0] as any)?.variants || []).filter(
    (v: any) =>
      COD_FEE_BANDS.some((b) => b.sku === v.sku) && v.manage_inventory === true
  )
  if (managed.length) {
    await updateProductVariantsWorkflow(container).run({
      input: {
        product_variants: managed.map((v: any) => ({
          id: v.id,
          manage_inventory: false,
        })),
      } as any,
    })
    logger.info(
      `✔ manage_inventory=false restored on: ${managed.map((v: any) => v.sku).join(", ")}`
    )
  }

  logger.info(
    `\nDone. Bands: ` +
      COD_FEE_BANDS.map((b) => `≤₹${b.max} → ₹${b.amount}`).join("  |  ")
  )
}
