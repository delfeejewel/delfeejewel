import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { generateInvoicePDF } from "../../../../../utils/invoice-generator"
import { getStoreInfo } from "../../../../../utils/get-store-info"
import { buildInvoiceData, INVOICE_ORDER_FIELDS } from "../../../../../utils/build-invoice-data"
import { verifyTrackToken } from "../../../../../utils/track-token"

/**
 * GET /store/orders/:id/invoice
 * Generates and returns a GST-compliant PDF invoice.
 * Seller info fetched from CMS (cms_store_info) with env fallback.
 *
 * Authorized exactly like GET /store/orders/:id (this endpoint exposes the same
 * order PII — buyer name/address, line items, totals — so it must not be an
 * IDOR): a logged-in customer is scoped to their own `customer_id`; a guest may
 * present a signed order token (`x-order-token` / `?token=`) whose `order_id`
 * matches the URL id. Anything else -> 401.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const filters: Record<string, any> = { id }
  const customerId = req.auth_context?.actor_id

  if (customerId) {
    filters.customer_id = customerId
  } else {
    const token =
      (req.headers["x-order-token"] as string) ||
      (req.query.token as string | undefined)
    const payload = verifyTrackToken(token)
    if (!payload || payload.order_id !== id) {
      return res.status(401).json({ message: "Unauthorized" })
    }
  }

  try {
    const [order_result, storeInfo] = await Promise.all([
      query.graph({
        entity: "order",
        fields: INVOICE_ORDER_FIELDS,
        filters,
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
    logger.error(`Invoice generation failed for order ${id}: ${error.message}`)
    return res.status(500).json({ message: "Failed to generate invoice" })
  }
}
