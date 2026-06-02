import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { generateInvoicePDF, InvoiceData } from "../../../../../utils/invoice-generator"
import { getStoreInfo, getStateCode } from "../../../../../utils/get-store-info"

/**
 * GET /store/orders/:id/invoice
 * Generates and returns a GST-compliant PDF invoice.
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
          "total", "subtotal", "tax_total", "created_at",
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
    const sellerState = storeInfo.state || "Haryana"
    const isIntraState = buyerState.toLowerCase() === sellerState.toLowerCase()
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
      seller_gstin: storeInfo.gstin || process.env.SELLER_GSTIN || "N/A",
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

      order_number: order.display_id,
      order_date: new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      }),
      currency_code: order.currency_code,

      items: ((order.items as any[]) || []).map((item) => ({
        name: item.title,
        hsn_code: (item.metadata as any)?.hsn_code || storeInfo.hsn_code || "7117",
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: Number((item.metadata as any)?.tax_rate) || defaultTaxRate,
      })),

      is_intra_state: isIntraState,
    }

    const pdfBuffer = await generateInvoicePDF(invoiceData)

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="Invoice-${order.display_id}.pdf"`)
    res.setHeader("Content-Length", pdfBuffer.length)

    return res.end(pdfBuffer)
  } catch (error: any) {
    logger.error(`Invoice generation failed for order ${id}: ${error.message}`)
    return res.status(500).json({ message: "Failed to generate invoice" })
  }
}
