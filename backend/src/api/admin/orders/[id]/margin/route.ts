import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { isCodProvider } from "../../../../../lib/is-cod-provider"

/**
 * GET /admin/orders/:id/margin
 *
 * Per-order profit bifurcation. Every figure is either measured or explicitly
 * reported as unknown — nothing is estimated silently, because a profit number
 * that quietly assumes a cost is worse than no number at all.
 *
 * Money model notes:
 *  - Catalogue prices are GST-INCLUSIVE, so revenue is stated net of tax:
 *    tax collected belongs to the government, never to margin.
 *  - `courier_rate` on the fulfillment is what Shiprocket actually charged;
 *    it exists only once an AWB has been assigned. Before that, shipping cost
 *    is unknown and reported as such.
 *  - The payment-gateway fee is a RATE-BASED ESTIMATE (Razorpay's standard
 *    ~2% + 18% GST on that fee), flagged `estimated: true`. COD orders pay no
 *    gateway fee on the balance, only on any upfront token.
 */

const GATEWAY_FEE_PERCENT = Number(process.env.GATEWAY_FEE_PERCENT ?? 2)
const GST_ON_FEE_PERCENT = 18

/** Service line items are cost recovery, not merchandise. */
const SERVICE_HANDLES = ["gift-wrap", "cod-fee"]

const round2 = (n: number) => Math.round(n * 100) / 100

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const orderId = req.params.id
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      filters: { id: orderId } as any,
      fields: [
        "id",
        "display_id",
        "currency_code",
        "total",
        "subtotal",
        "tax_total",
        "discount_total",
        "shipping_total",
        "shipping_subtotal",
        "item_total",
        "metadata",
        // MUST be "items.*", not a list of "items.x" fields: naming them
        // individually returns the line rows with quantity/total UNDEFINED,
        // which silently produces a zero-revenue breakdown. Verified against
        // real orders.
        "items.*",
        "fulfillments.id",
        "fulfillments.data",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.amount",
      ],
    })

    const order = (orders as any[])?.[0]
    if (!order) {
      return res.status(404).json({ message: "Order not found." })
    }

    const items: any[] = order.items || []
    const merchandise = items.filter(
      (i) => !SERVICE_HANDLES.includes(i.product_handle)
    )
    const services = items.filter((i) =>
      SERVICE_HANDLES.includes(i.product_handle)
    )

    // ---- product cost (COGS) ------------------------------------------------
    const variantIds = merchandise.map((i) => i.variant_id).filter(Boolean)

    const costByVariant = new Map<string, number>()
    if (variantIds.length) {
      const { data: variants } = await query.graph({
        entity: "variant",
        filters: { id: variantIds } as any,
        fields: ["id", "metadata"],
      })
      for (const v of (variants as any[]) || []) {
        const raw = (v?.metadata as any)?.cost_price
        const n = Number(raw)
        if (Number.isFinite(n) && n > 0) costByVariant.set(v.id, n)
      }
    }

    const lines = merchandise.map((i) => {
      const unitCost = costByVariant.get(i.variant_id) ?? null
      const qty = Number(i.quantity) || 0
      // Net of tax: prices are GST-inclusive, so the taxable value is what we
      // actually keep from the sale.
      const revenueNet = round2(
        (Number(i.total) || 0) - (Number(i.tax_total) || 0)
      )
      const cost = unitCost !== null ? round2(unitCost * qty) : null
      return {
        title: i.title,
        quantity: qty,
        revenue_net: revenueNet,
        unit_cost: unitCost,
        cost,
        profit: cost !== null ? round2(revenueNet - cost) : null,
        cost_known: cost !== null,
      }
    })

    const cogs = lines.reduce((s, l) => s + (l.cost ?? 0), 0)
    const missingCost = lines.filter((l) => !l.cost_known)

    // ---- shipping -----------------------------------------------------------
    const shippingCharged = round2(
      (Number(order.shipping_subtotal ?? order.shipping_total) || 0)
    )

    // The rate is written by the Shiprocket provider when an AWB is assigned.
    const fulfillment = (order.fulfillments || []).find(
      (f: any) => f?.data?.courier_rate != null
    )
    const shippingActualRaw = fulfillment?.data?.courier_rate
    const shippingActual =
      shippingActualRaw != null && Number.isFinite(Number(shippingActualRaw))
        ? round2(Number(shippingActualRaw))
        : null

    const courierName =
      (order.fulfillments || []).find((f: any) => f?.data?.courier_name)?.data
        ?.courier_name ?? null

    // ---- payment gateway ----------------------------------------------------
    const payments = (order.payment_collections || []).flatMap(
      (pc: any) => pc?.payments || []
    )
    const isCod = payments.some((p: any) => isCodProvider(p?.provider_id))
    const prepaidAmount = isCod
      ? Number((order.metadata as any)?.cod_upfront_amount) || 0
      : Number(order.total) || 0

    const gatewayFee = round2(
      (prepaidAmount * GATEWAY_FEE_PERCENT * (1 + GST_ON_FEE_PERCENT / 100)) /
        100
    )

    // ---- roll-up ------------------------------------------------------------
    const merchandiseRevenueNet = lines.reduce((s, l) => s + l.revenue_net, 0)
    const servicesRevenueNet = services.reduce(
      (s, i) => s + ((Number(i.total) || 0) - (Number(i.tax_total) || 0)),
      0
    )
    const shippingMargin =
      shippingActual !== null ? round2(shippingCharged - shippingActual) : null

    const knownCosts =
      cogs + (shippingActual ?? 0) + gatewayFee
    const grossProfit = round2(
      merchandiseRevenueNet + servicesRevenueNet + shippingCharged - knownCosts
    )

    const complete = missingCost.length === 0 && shippingActual !== null

    return res.json({
      order_id: order.id,
      display_id: order.display_id,
      currency_code: order.currency_code,
      complete,
      revenue: {
        merchandise_net: round2(merchandiseRevenueNet),
        services_net: round2(servicesRevenueNet),
        shipping_charged: shippingCharged,
        discount: round2(Number(order.discount_total) || 0),
        tax_collected: round2(Number(order.tax_total) || 0),
        order_total: round2(Number(order.total) || 0),
      },
      costs: {
        cogs: round2(cogs),
        cogs_known: missingCost.length === 0,
        missing_cost_items: missingCost.map((l) => l.title),
        shipping_actual: shippingActual,
        courier_name: courierName,
        gateway_fee: gatewayFee,
        gateway_fee_estimated: true,
        gateway_fee_basis: {
          percent: GATEWAY_FEE_PERCENT,
          gst_on_fee_percent: GST_ON_FEE_PERCENT,
          charged_on: round2(prepaidAmount),
          is_cod: isCod,
        },
      },
      shipping_margin: shippingMargin,
      gross_profit: grossProfit,
      margin_percent:
        merchandiseRevenueNet > 0
          ? round2((grossProfit / merchandiseRevenueNet) * 100)
          : null,
      lines,
    })
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Could not compute margin." })
  }
}
