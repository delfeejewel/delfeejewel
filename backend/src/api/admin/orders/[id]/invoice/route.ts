import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { generateInvoicePDF, InvoiceData } from "../../../../../utils/invoice-generator"
import { getStoreInfo, getStateCode } from "../../../../../utils/get-store-info"

/**
 * GET /admin/orders/:id/invoice
 * Admin endpoint — generates GST invoice PDF.
 * Seller info fetched from CMS (cms_store_info) with env fallback.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const [order_result, storeInfo] = await Promise.all([
      query.graph({
        entity: "order",
        fields: [
          "id", "display_id", "email", "currency_code",
          "total", "subtotal", "tax_total", "shipping_total", "created_at",
          "items.*", "shipping_address.*",
        ],
        filters: { id },
      }),
      getStoreInfo(),
    ])

    const order = order_result.data?.[0]
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

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
    const sellerAddress = [storeInfo.address, storeInfo.city, storeInfo.state, storeInfo.pincode]
      .filter(Boolean).join(", ")

    const invoiceData: InvoiceData = {
      invoice_number: `INV-${order.display_id}`,
      invoice_date: new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      }),

      seller_name: storeInfo.store_name || process.env.BRAND_NAME || "Delfee",
      seller_address: sellerAddress,
      seller_gstin: storeInfo.gstin || "N/A",
      seller_state: sellerState,
      seller_state_code: getStateCode(sellerState),

      buyer_name: address
        ? `${address.first_name || ""} ${address.last_name || ""}`.trim()
        : order.email || "Customer",
      buyer_address: address
        ? [address.address_1, address.address_2, address.city, buyerState, address.postal_code]
            .filter(Boolean).join(", ")
        : "",
      buyer_state: buyerState || "N/A",
      buyer_gstin: address?.metadata?.gstin || undefined,

      order_number: order.display_id ?? order.id,
      order_date: new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      }),
      currency_code: order.currency_code,

      items: [
        ...((order.items as any[]) || []).map((item) => ({
          name: item.title,
          hsn_code: (item.metadata as any)?.hsn_code || storeInfo.hsn_code || "7117",
          quantity: item.quantity,
          unit_price: item.unit_price,
          // Use the line total when present, even when it's 0 (a 100%-off
          // promo item). `Number(x) || undefined` wrongly treated 0 as missing
          // and fell back to unit_price × qty, billing a free item at full price.
          line_total: item.total != null ? Number(item.total) : undefined,
          tax_rate: Number((item.metadata as any)?.tax_rate) || defaultTaxRate,
        })),
        // Shipping is part of what the customer paid — invoice it as its own
        // line (SAC 996812, courier services) so the grand total matches.
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

    const pdfBuffer = await generateInvoicePDF(invoiceData)

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="Invoice-${order.display_id}.pdf"`)
    res.setHeader("Content-Length", pdfBuffer.length)

    return res.end(pdfBuffer)
  } catch (error: any) {
    logger.error(`Admin invoice failed for order ${id}: ${error.message}`)
    return res.status(500).json({ message: "Failed to generate invoice" })
  }
}
