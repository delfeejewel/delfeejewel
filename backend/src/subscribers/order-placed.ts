import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { convertToLocale } from "../utils/money"
import { signTrackToken } from "../utils/track-token"
import EmailNotificationService from "../modules/email_notification/service"
import { generateInvoicePDF } from "../utils/invoice-generator"
import { buildInvoiceData, INVOICE_ORDER_FIELDS } from "../utils/build-invoice-data"
import { getStoreInfo } from "../utils/get-store-info"

/**
 * Build the GST invoice PDF to attach to the order confirmation.
 *
 * Deliberately best-effort: if anything here fails (CMS store info unreachable,
 * PDF generation error), we log and return null so the customer still gets their
 * confirmation email. A missing attachment is recoverable — the invoice is also
 * downloadable from the order page — but a swallowed confirmation is not.
 */
async function buildInvoiceAttachment(
  query: any,
  orderId: string,
  logger: any
): Promise<{ filename: string; content: Buffer }[] | undefined> {
  try {
    const [{ data: rows }, storeInfo] = await Promise.all([
      query.graph({
        entity: "order",
        fields: INVOICE_ORDER_FIELDS,
        filters: { id: orderId },
      }),
      getStoreInfo(),
    ])
    const fullOrder = rows?.[0]
    if (!fullOrder) return undefined

    const pdf = await generateInvoicePDF(buildInvoiceData(fullOrder, storeInfo))
    return [{ filename: `Invoice-${fullOrder.display_id}.pdf`, content: pdf }]
  } catch (e: any) {
    logger.warn(
      `Could not attach invoice PDF to order ${orderId} confirmation: ${e?.message}`
    )
    return undefined
  }
}

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const emailService: EmailNotificationService = container.resolve(
    "email_notification"
  )

  try {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "tax_total",
        "discount_total",
        "metadata",
        "items.*",
        "items.product.handle",
        "shipping_address.*",
        // COD upfront token is stamped on the cart at verify time; it does NOT
        // copy to the order on completion, so we read it across the link here.
        "cart.metadata",
      ],
      filters: { id: data.id },
    })

    if (!order) return

    const orderMeta = (order.metadata as any) || {}
    const cartMeta = ((order as any).cart?.metadata as any) || {}
    const codUpfront = Number(cartMeta.cod_upfront_amount) || 0

    // Build a single metadata patch: gift-wrap flag (ops/packaging) + the COD
    // upfront token bridged from the cart so order pages/email can show it.
    const metaPatch: Record<string, any> = {}
    const hasGiftWrap = ((order.items as any[]) || []).some(
      (it) => it?.product?.handle === "gift-wrap"
    )
    if (hasGiftWrap && !orderMeta.gift_wrap) {
      metaPatch.gift_wrap = true
    }
    if (codUpfront > 0 && !orderMeta.cod_upfront_amount) {
      metaPatch.cod_upfront_amount = codUpfront
      metaPatch.cod_upfront_payment_id = cartMeta.cod_upfront_payment_id
      metaPatch.cod_upfront_paid_at = cartMeta.cod_upfront_paid_at
    }
    if (Object.keys(metaPatch).length > 0) {
      try {
        const orderModule: any = container.resolve(Modules.ORDER)
        await orderModule.updateOrders([
          { id: order.id, metadata: { ...orderMeta, ...metaPatch } },
        ])
      } catch (e: any) {
        logger.warn(`Could not patch metadata on order ${order.id}: ${e?.message}`)
      }
    }

    const address = order.shipping_address
    const shippingStr = address
      ? `${address.first_name} ${address.last_name}, ${address.address_1}, ${address.city}, ${address.postal_code}`
      : undefined

    const cc = order.currency_code
    const subtotalNum = (order.items || []).reduce(
      (sum: number, it: any) =>
        sum + (Number(it.unit_price) || 0) * (it.quantity || 1),
      0
    )
    const discountNum = Number(order.discount_total) || 0
    const taxNum = Number(order.tax_total) || 0
    const totalNum = Number(order.total) || subtotalNum
    // Derive shipping so the breakdown always reconciles with the total.
    const shippingNum = Math.max(0, totalNum - subtotalNum - taxNum + discountNum)

    // COD partial payment: token paid now vs balance due on delivery.
    const codDueNum = codUpfront > 0 ? Math.max(0, totalNum - codUpfront) : 0

    await emailService.sendOrderEmail("order.placed", {
      order_id: order.id,
      order_number: order.display_id ?? order.id,
      customer_name: address?.first_name || "Customer",
      customer_email: order.email ?? "",
      subtotal: convertToLocale(subtotalNum, cc),
      shipping: shippingNum > 0 ? convertToLocale(shippingNum, cc) : undefined,
      shipping_is_free: shippingNum === 0,
      discount: discountNum > 0 ? `−${convertToLocale(discountNum, cc)}` : undefined,
      total: convertToLocale(totalNum, cc),
      cod_paid: codUpfront > 0 ? convertToLocale(codUpfront, cc) : undefined,
      cod_due: codUpfront > 0 ? convertToLocale(codDueNum, cc) : undefined,
      items: (order.items || []).map((item: any) => ({
        title: item.title,
        quantity: item.quantity,
        price: convertToLocale(item.unit_price * item.quantity, cc),
      })),
      shipping_address: shippingStr,
      track_token: order.email
        ? signTrackToken({ order_id: order.id, email: order.email })
        : undefined,
      brand_name: process.env.BRAND_NAME || "Delfee",
    }, await buildInvoiceAttachment(query, order.id, logger))
  } catch (error: any) {
    logger.error(`Order placed email failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
