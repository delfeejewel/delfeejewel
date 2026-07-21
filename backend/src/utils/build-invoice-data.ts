import { InvoiceData } from "./invoice-generator"
import { getStateCode } from "./get-store-info"

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
  "total",
  "subtotal",
  "tax_total",
  "shipping_total",
  "created_at",
  "items.*",
  "shipping_address.*",
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
  const sellerAddress = [
    storeInfo.address,
    storeInfo.city,
    storeInfo.state,
    storeInfo.pincode,
  ]
    .filter(Boolean)
    .join(", ")

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
        tax_rate: Number((item.metadata as any)?.tax_rate) || defaultTaxRate,
      })),
      // Shipping is part of what the customer paid — invoice it as its own line
      // (SAC 996812, courier services) so the grand total matches.
      ...(Number(order.shipping_total) > 0
        ? [
            {
              name: "Shipping & Handling",
              hsn_code: "996812",
              quantity: 1,
              unit_price: Number(order.shipping_total),
              line_total: Number(order.shipping_total),
              tax_rate: defaultTaxRate,
            },
          ]
        : []),
    ],

    is_intra_state: isIntraState,
  }
}
