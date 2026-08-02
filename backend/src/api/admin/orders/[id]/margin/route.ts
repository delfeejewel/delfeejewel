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

/**
 * What the COURIER charges US to handle a COD shipment — distinct from the
 * COD fee we charge the customer (the `cod-fee` service line, revenue).
 *
 * `courier_rate` on the fulfillment is freight ONLY; the COD charge is debited
 * from the Shiprocket wallet on top of it and appears nowhere in the AWB
 * response. Order #9 measured the gap: ₹208.18 debited against a ₹148.95
 * freight quote, so ~₹59.23 of COD charge + GST went unaccounted.
 *
 * Shiprocket bills this as max(flat, percent × collectable), plus GST. The
 * defaults below reproduce order #9 to within ₹0.23 (max(50, 2% × 1019.30) ×
 * 1.18 = ₹59.00 vs ₹59.23 observed) but are NOT confirmed against a passbook
 * entry — treat them as a working estimate until they are, and override via
 * env if your slab differs.
 *
 * A measured figure always wins: set `cod_charge_actual` on the fulfillment
 * data (from the Shiprocket passbook) and it is used verbatim, un-estimated.
 */
const COD_CHARGE_FLAT = Number(process.env.SHIPROCKET_COD_FEE_FLAT ?? 50)
const COD_CHARGE_PERCENT = Number(process.env.SHIPROCKET_COD_FEE_PERCENT ?? 2)

/** Service line items are cost recovery, not merchandise. */
const SERVICE_HANDLES = ["gift-wrap", "cod-fee"]

const round2 = (n: number) => Math.round(n * 100) / 100

/** Money inside human-readable hint strings, e.g. 1244.15 → "₹1,244.15". */
const money = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

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
        // Carries the promotion CODE actually applied to each line, which is
        // the only place the customer-facing coupon name survives on the order.
        "items.adjustments.*",
        "items.tax_lines.rate",
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

    // ---- customer-facing money trail ---------------------------------------
    // Reads the way the customer experienced it: list price → coupon → price
    // paid → add-on fees → shipping. Catalogue prices are GST-INCLUSIVE, so
    // every gross figure is split into its ex-GST base and the GST inside it.
    //
    // `unit_price` is the price at the time of order (already reflecting any
    // sale price), BEFORE any coupon. `total`/`tax_total` are post-coupon. The
    // pre-coupon tax split has to be derived from the line's own rate, because
    // Medusa only stores tax for the amount actually charged.
    const splitInclusive = (gross: number, ratePercent: number) => {
      const net = round2(gross / (1 + ratePercent / 100))
      return { gross: round2(gross), net, tax: round2(gross - net) }
    }

    const merchandiseRate = Number(merchandise[0]?.tax_lines?.[0]?.rate) || 0
    const listGross = merchandise.reduce(
      (s, i) => s + (Number(i.unit_price) || 0) * (Number(i.quantity) || 0),
      0
    )
    const merchandiseDiscount = merchandise.reduce(
      (s, i) => s + (Number(i.discount_total) || 0),
      0
    )
    const paidGross = merchandise.reduce((s, i) => s + (Number(i.total) || 0), 0)
    const paidTax = merchandise.reduce(
      (s, i) => s + (Number(i.tax_total) || 0),
      0
    )

    // Promotion codes actually applied, from the line adjustments.
    const discountCodes = Array.from(
      new Set(
        items.flatMap((i) =>
          ((i.adjustments as any[]) || []).map((a) => a?.code).filter(Boolean)
        )
      )
    )

    // Each add-on fee (COD handling, gift wrap) listed on its own, with its
    // own GST split — they can sit at different rates from the merchandise.
    const serviceLines = services.map((i) => {
      const gross = Number(i.total) || 0
      const tax = Number(i.tax_total) || 0
      return {
        handle: i.product_handle,
        title: i.title,
        gross: round2(gross),
        net: round2(gross - tax),
        tax: round2(tax),
      }
    })

    const shippingTax = round2(
      (Number(order.shipping_total) || 0) -
        (Number(order.shipping_subtotal) || 0)
    )
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

    // ---- courier COD charge -------------------------------------------------
    // Only COD orders incur one, and only on the balance the courier actually
    // collects (total minus any upfront token) — the same figure sent to
    // Shiprocket as the collectable amount.
    const codCollectable = isCod
      ? Math.max(0, (Number(order.total) || 0) - prepaidAmount)
      : 0

    // Preference order, most authoritative first:
    //   1. cod_charge_actual  — hand-entered from the Shiprocket passbook
    //   2. cod_charges        — Shiprocket's own quote, captured at AWB
    //                           assignment from the serviceability response
    //   3. the estimate below — only when neither was recorded
    const codChargeMeasuredRaw = (order.fulfillments || []).find(
      (f: any) => f?.data?.cod_charge_actual != null || f?.data?.cod_charges != null
    )?.data
    const codChargeRaw =
      codChargeMeasuredRaw?.cod_charge_actual ?? codChargeMeasuredRaw?.cod_charges
    const codChargeActual =
      codChargeRaw != null && Number.isFinite(Number(codChargeRaw))
        ? round2(Number(codChargeRaw))
        : null
    const codChargeSource =
      codChargeMeasuredRaw?.cod_charge_actual != null
        ? "passbook"
        : codChargeMeasuredRaw?.cod_charges != null
          ? "shiprocket quote"
          : null

    const codChargeEstimated =
      codChargeActual === null && isCod
        ? round2(
            Math.max(
              COD_CHARGE_FLAT,
              (codCollectable * COD_CHARGE_PERCENT) / 100
            ) *
              (1 + GST_ON_FEE_PERCENT / 100)
          )
        : 0

    const codCharge = isCod ? (codChargeActual ?? codChargeEstimated) : 0
    const codChargeIsEstimate = isCod && codChargeActual === null

    // ---- roll-up ------------------------------------------------------------
    const merchandiseRevenueNet = lines.reduce((s, l) => s + l.revenue_net, 0)
    const servicesRevenueNet = services.reduce(
      (s, i) => s + ((Number(i.total) || 0) - (Number(i.tax_total) || 0)),
      0
    )
    const shippingMargin =
      shippingActual !== null ? round2(shippingCharged - shippingActual) : null

    // Courier extras and sunk spend, read off whichever fulfilment carries
    // them. Both are real money out, so they join knownCosts rather than only
    // appearing as display rows.
    const fulfilData = (order.fulfillments || []).map((f: any) => f?.data || {})
    const sumKey = (key: string) =>
      round2(fulfilData.reduce((s: number, d: any) => s + (Number(d?.[key]) || 0), 0))

    const whatsappCharge = sumKey("courier_whatsapp_charge")
    const cancelledCharges = sumKey("cancelled_awb_charges")
    const cancelledCount = fulfilData.reduce(
      (s: number, d: any) => s + (Number(d?.cancelled_awb_count) || 0),
      0
    )
    const cancelledCodes = fulfilData
      .map((d: any) => d?.cancelled_awb_codes)
      .filter(Boolean)
      .join(", ")

    const knownCosts =
      cogs +
      (shippingActual ?? 0) +
      gatewayFee +
      codCharge +
      whatsappCharge +
      cancelledCharges
    const grossProfit = round2(
      merchandiseRevenueNet + servicesRevenueNet + shippingCharged - knownCosts
    )

    // "Complete" must mean every cost is MEASURED, per this route's contract
    // that nothing is estimated silently. The gateway fee has always been a
    // rate-based estimate, so it is excluded from that promise by long-standing
    // design; an estimated courier COD charge is not — it is a real invoice
    // from Shiprocket that we simply have not read yet, so it downgrades the
    // breakdown to Partial until `cod_charge_actual` is filled in.
    const complete =
      missingCost.length === 0 && shippingActual !== null && !codChargeIsEstimate

    // ---- cost groups --------------------------------------------------------
    // Each cost we bear, paired with what (if anything) we recovered from the
    // customer for it, and the difference. PRESENTATIONAL ONLY — gross_profit
    // above is computed from the raw figures, so nothing here double-counts.
    //
    // Recovery is stated NET of GST, matching the revenue convention: tax
    // collected is the government's, never margin. Costs are stated as
    // actually charged, which for courier and gateway lines INCLUDES their
    // GST — that input tax may be creditable to you as ITC, which this widget
    // does not model, so these margins are slightly pessimistic if you claim it.
    const codFeeLine = serviceLines.find((s) => s.handle === "cod-fee")

    const costGroups = [
      {
        key: "product",
        label: "Product",
        cost: round2(cogs),
        cost_known: missingCost.length === 0,
        cost_hint: missingCost.length
          ? `cost price not set: ${missingCost.map((l) => l.title).join(", ")}`
          : null,
        cost_label: "Cost to us",
        collected_label: "Collected from customer",
        collected_net: round2(merchandiseRevenueNet),
        collected_tax: round2(paidTax),
        margin:
          missingCost.length === 0
            ? round2(merchandiseRevenueNet - cogs)
            : null,
      },
      {
        key: "shipping",
        label: "Shipping",
        cost: shippingActual,
        cost_known: shippingActual !== null,
        cost_hint: shippingActual === null
          ? "unknown until a courier is assigned"
          : courierName,
        cost_label: "Paid to courier",
        collected_label: "Charged to customer",
        collected_net: round2(shippingCharged - shippingTax),
        collected_tax: shippingTax,
        margin:
          shippingActual !== null
            ? round2(shippingCharged - shippingTax - shippingActual)
            : null,
      },
      {
        key: "gateway",
        label: "Payment gateway",
        cost: gatewayFee,
        cost_known: true,
        cost_hint: `estimated ${GATEWAY_FEE_PERCENT}% + ${GST_ON_FEE_PERCENT}% GST on ${money(prepaidAmount)}${isCod ? " — the COD token only, never the cash balance" : ""}`,
        cost_label: "Paid to gateway",
        // Never recovered — the gateway fee is always absorbed.
        collected_label: null,
        collected_net: null,
        collected_tax: 0,
        margin: round2(-gatewayFee),
      },
    ]

    if (whatsappCharge > 0) {
      costGroups.push({
        key: "whatsapp",
        label: "Courier WhatsApp updates",
        cost: whatsappCharge,
        cost_known: true,
        cost_hint: "per-shipment charge for customer tracking notifications",
        cost_label: "Paid to courier",
        collected_label: null,
        collected_net: null,
        collected_tax: 0,
        margin: round2(-whatsappCharge),
      })
    }

    if (cancelledCharges > 0) {
      costGroups.push({
        key: "cancelled",
        label: "Cancelled labels",
        cost: cancelledCharges,
        cost_known: true,
        // Shiprocket debits at assignment, so a cancelled AWB is money already
        // gone. Whether they credit it back is not visible from the API — only
        // the wallet passbook shows a refund, so this is stated as spent.
        cost_hint:
          `${cancelledCount} voided AWB${cancelledCount === 1 ? "" : "s"}` +
          (cancelledCodes ? ` (${cancelledCodes})` : "") +
          ` — charged at assignment; check the passbook for any credit`,
        cost_label: "Spent and written off",
        collected_label: null,
        collected_net: null,
        collected_tax: 0,
        margin: round2(-cancelledCharges),
      })
    }

    if (isCod) {
      costGroups.push({
        key: "cod",
        label: "Courier COD charge",
        cost: codCharge,
        cost_known: !codChargeIsEstimate,
        cost_hint: codChargeIsEstimate
          ? `ESTIMATED — max(${money(COD_CHARGE_FLAT)}, ${COD_CHARGE_PERCENT}% of ${money(codCollectable)}) + ${GST_ON_FEE_PERCENT}% GST. ` +
            `No courier quote was recorded on this shipment — reassign the AWB, or set cod_charge_actual from the Shiprocket passbook.`
          : `${courierName || "courier"} — ${codChargeSource}`,
        cost_label: "Paid to courier",
        collected_label: "COD fee collected",
        collected_net: codFeeLine ? codFeeLine.net : 0,
        collected_tax: codFeeLine ? codFeeLine.tax : 0,
        margin: round2((codFeeLine ? codFeeLine.net : 0) - codCharge),
      })
    }

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
      // Step-by-step money trail, in the order the customer met it.
      breakdown: {
        list_price: splitInclusive(listGross, merchandiseRate),
        discount: round2(merchandiseDiscount),
        discount_codes: discountCodes,
        after_discount: {
          gross: round2(paidGross),
          net: round2(paidGross - paidTax),
          tax: round2(paidTax),
        },
        services: serviceLines,
        shipping: {
          gross: shippingCharged,
          net: round2(shippingCharged - shippingTax),
          tax: shippingTax,
        },
        order_total: round2(Number(order.total) || 0),
        // How the total splits across the two moments money arrives. For COD
        // that is the upfront token (already captured online) and the balance
        // the courier collects on delivery; for a prepaid order it is all
        // collected up front and there is no balance.
        payment: {
          is_cod: isCod,
          paid_online: round2(prepaidAmount),
          balance_due: round2(codCollectable),
        },
      },
      costs: {
        cogs: round2(cogs),
        cogs_known: missingCost.length === 0,
        missing_cost_items: missingCost.map((l) => l.title),
        shipping_actual: shippingActual,
        courier_name: courierName,
        gateway_fee: gatewayFee,
        gateway_fee_estimated: true,
        courier_cod_charge: codCharge,
        courier_cod_charge_estimated: codChargeIsEstimate,
        courier_cod_charge_basis: {
          applies: isCod,
          flat: COD_CHARGE_FLAT,
          percent: COD_CHARGE_PERCENT,
          gst_on_fee_percent: GST_ON_FEE_PERCENT,
          charged_on: round2(codCollectable),
        },
        gateway_fee_basis: {
          percent: GATEWAY_FEE_PERCENT,
          gst_on_fee_percent: GST_ON_FEE_PERCENT,
          charged_on: round2(prepaidAmount),
          is_cod: isCod,
        },
      },
      cost_groups: costGroups,
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
