import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { generateInvoicePDF } from "../../../../../utils/invoice-generator"
import { getStoreInfo } from "../../../../../utils/get-store-info"
import { buildInvoiceData, INVOICE_ORDER_FIELDS } from "../../../../../utils/build-invoice-data"

/**
 * GET /admin/orders/:id/invoice
 * Admin endpoint — generates GST invoice PDF.
 * Seller info fetched from CMS (cms_store_info) with env fallback.
 *
 * Shares buildInvoiceData()/INVOICE_ORDER_FIELDS with the store invoice
 * route and the order-confirmation email — this used to duplicate that
 * logic inline, which let it drift (e.g. missing the COD payment
 * breakdown the other two got).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const [order_result, storeInfo] = await Promise.all([
      query.graph({
        entity: "order",
        fields: INVOICE_ORDER_FIELDS,
        filters: { id },
      }),
      getStoreInfo(),
    ])

    const order = order_result.data?.[0]
    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    const invoiceData = buildInvoiceData(order, storeInfo)

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
