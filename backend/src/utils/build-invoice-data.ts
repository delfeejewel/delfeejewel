import { InvoiceData } from "./invoice-generator"
import { getStateCode } from "./get-store-info"
import { isCodProvider } from "../lib/is-cod-provider"

/**
 * Shared GST-invoice construction.
 *
 * Extracted from the store/admin invoice routes so the PDF attached to the
 * order-confirmation email is byte-for-byte the same document the customer can
 * download later. Duplicating this logic would let the two drift — and a tax
 * document that disagrees with itself is worse than no attachment at all.
 */

/** Fields an order must be fetched with for buildInvoiceData() to work. */
export const INVOICE_ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "currency_code",
  "canceled_at",
  "total",
  "subtotal",
  "tax_total",
  "shipping_total",
  "discount_total",
  "items.discount_total",
  /**
   * The whole shipping method, not just its discount.
   *
   * Medusa computes an order's totals from the fields you actually request:
   * without these, `shipping_total` came back 0 and `total` came back short by
   * the shipping amount, so the invoice billed less than the customer paid
   * (order #9: 1,324.15 printed vs 1,444.15 charged) and showed no shipping
   * line at all.
   */
  "shipping_methods.*",
  "created_at",
  "metadata",
  "items.*",
  "shipping_address.*",
  // The code the customer used, printed on the invoice beside the amount.
  "promotions.code",
  "payment_collections.payments.provider_id",
  "payment_collections.payment_sessions.provider_id",
]

const fmtDate = (d: any) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

export function buildInvoiceData(order: any, storeInfo: any): InvoiceData {
  const address = order.shipping_address as any
  const buyerState = address?.province || address?.state || ""
  const sellerState = storeInfo.state || "Chandigarh"

  // Compare GST state codes, not raw strings — buyers type free text
  // ("CH", "chandigarh", "Chandigarh") in the province field.
  const buyerCode = getStateCode(buyerState)
  const sellerCode = getStateCode(sellerState)
  const isIntraState =
    buyerCode !== "99" && sellerCode !== "99"
      ? buyerCode === sellerCode
      : buyerState.trim().toLowerCase() === sellerState.trim().toLowerCase()

  const defaultTaxRate = Number(storeInfo.gst_rate) || 3

  // Payment breakdown: Shiprocket's own shipping label has no field for
  // "amount already paid online" (see modules/shiprocket/service.ts), so
  // this invoice — which we fully control — is the one place that can show
  // Grand Total − Paid Online = Balance Due for a COD-with-upfront-token
  // order. isCodProvider mirrors the same detection used for the courier.
  const providerIds: string[] = ((order.payment_collections as any[]) || []).flatMap(
    (pc: any) => [
      ...((pc.payments || []).map((p: any) => p.provider_id)),
      ...((pc.payment_sessions || []).map((s: any) => s.provider_id)),
    ]
  )
  const isCod = providerIds.some(isCodProvider)
  const grandTotal = Number(order.total) || 0
  const upfrontPaid = Number((order.metadata as any)?.cod_upfront_amount) || 0
  const amountPaidOnline = isCod ? upfrontPaid : grandTotal
  const balanceDue = Math.max(0, grandTotal - amountPaidOnline)
  const sellerAddress = [
    storeInfo.address,
    storeInfo.city,
    storeInfo.state,
    storeInfo.pincode,
  ]
    .filter(Boolean)
    .join(", ")

  /**
   * What came off the order. Prefer the order-level figure; fall back to the
   * line/shipping breakdown for orders where it isn't populated, so a real
   * discount is never printed as zero.
   */
  const discountAmount =
    Number(order.discount_total) ||
    ((order.items as any[]) || []).reduce(
      (sum: number, i: any) => sum + (Number(i.discount_total) || 0),
      0
    ) +
      ((order.shipping_methods as any[]) || []).reduce(
        (sum: number, m: any) => sum + (Number(m.discount_total) || 0),
        0
      )

  const discountCodes: string[] = ((order.promotions as any[]) || [])
    .map((p: any) => p?.code)
    .filter(Boolean)

  return {
    invoice_number: `INV-${order.display_id}`,
    invoice_date: fmtDate(order.created_at),

    seller_name: storeInfo.store_name || process.env.BRAND_NAME || "Delfee",
    seller_address: sellerAddress,
    seller_gstin: storeInfo.gstin || process.env.SELLER_GSTIN || "N/A",
    seller_state: sellerState,
    seller_state_code: getStateCode(sellerState),

    buyer_name: address
      ? `${address.first_name || ""} ${address.last_name || ""}`.trim()
      : order.email || "Customer",
    buyer_address: address
      ? [
          address.address_1,
          address.address_2,
          address.city,
          buyerState,
          address.postal_code,
        ]
          .filter(Boolean)
          .join(", ")
      : "",
    buyer_state: buyerState || "N/A",
    buyer_gstin: address?.metadata?.gstin || undefined,

    order_number: order.display_id ?? order.id,
    order_date: fmtDate(order.created_at),
    currency_code: order.currency_code,

    items: [
      ...((order.items as any[]) || []).map((item) => ({
        name: item.title,
        hsn_code:
          (item.metadata as any)?.hsn_code || storeInfo.hsn_code || "7117",
        quantity: item.quantity,
        unit_price: item.unit_price,
        // Use the line total when present, even when it's 0 (a 100%-off promo
        // item). `Number(x) || undefined` wrongly treated 0 as missing and fell
        // back to unit_price × qty, billing a free item at full price.
        line_total: item.total != null ? Number(item.total) : undefined,
        // Printed beside the rate so the gap between "1,499" and what was
        // charged is explained on the line itself.
        discount: Number(item.discount_total) || 0,
        tax_rate: Number((item.metadata as any)?.tax_rate) || defaultTaxRate,
      })),
      // Shipping is part of what the customer paid — invoice it as its own line
      // (SAC 996812, courier services) so the grand total matches. Tax-exempt
      // (0%) — shipping carries a dedicated 0% tax rate rule, set up
      // separately from the item rate.
      ...(Number(order.shipping_total) > 0
        ? [
            {
              name: "Shipping & Handling",
              hsn_code: "996812",
              quantity: 1,
              unit_price: Number(order.shipping_total),
              line_total: Number(order.shipping_total),
              discount: ((order.shipping_methods as any[]) || []).reduce(
                (sum: number, m: any) => sum + (Number(m.discount_total) || 0),
                0
              ),
              tax_rate: 0,
            },
          ]
        : []),
    ],

    ...(discountAmount > 0
      ? { discount: { amount: discountAmount, codes: discountCodes } }
      : {}),

    is_intra_state: isIntraState,
    is_cancelled: !!order.canceled_at,
    payment_summary: { is_cod: isCod, amount_paid_online: amountPaidOnline, balance_due: balanceDue },
  }
}
