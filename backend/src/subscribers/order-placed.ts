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

/**
 * Where the shop's own copy of an order goes.
 *
 * Defaults to the public enquiries inbox so this works with no config; the env
 * vars are there for staging (or a dedicated orders@ address later) without a
 * code change. `ORDER_NOTIFICATION_EMAIL` may be a comma-separated list.
 */
function shopNotificationRecipients(): string {
  return (
    process.env.ORDER_NOTIFICATION_EMAIL ||
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    "enquire@delfee.in"
  )
}

/** Human label for the payment provider id ("pp_razorpay_razorpay" → "Razorpay"). */
function paymentLabel(order: any): string | null {
  const provider: string | undefined = (order.payment_collections || [])
    .flatMap((pc: any) => pc?.payments || [])
    .map((p: any) => p?.provider_id)
    .find(Boolean)
  if (!provider) return null
  if (/razorpay/i.test(provider)) return "Razorpay (prepaid)"
  if (/cod|cash/i.test(provider)) return "Cash on Delivery"
  if (/manual|system/i.test(provider)) return "Manual / system"
  return provider
}

/**
 * Email the shop its own copy of the order — items, customer, address, totals.
 *
 * Best-effort and always AFTER the customer's confirmation: this is an internal
 * convenience, and it must never be the reason a buyer's confirmation fails.
 */
async function sendShopNotification(
  emailService: EmailNotificationService,
  order: any,
  amounts: {
    subtotal: number
    shipping: number
    discount: number
    total: number
    codUpfront: number
    codDue: number
    logger: any
  }
) {
  const { logger } = amounts
  try {
    const cc = order.currency_code
    const address = order.shipping_address
    const customer = order.customer

    const customerName =
      [address?.first_name, address?.last_name].filter(Boolean).join(" ") ||
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
      "Customer"

    const adminBase = (
      process.env.MEDUSA_BACKEND_URL || process.env.ADMIN_URL || ""
    ).replace(/\/$/, "")

    await emailService.sendOrderAdminNotificationEmail({
      to: shopNotificationRecipients(),
      order_id: order.id,
      order_number: order.display_id ?? order.id,
      placed_at: new Date(order.created_at ?? Date.now()).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }),
      customer_name: customerName,
      customer_email: order.email ?? "",
      customer_phone: address?.phone || customer?.phone || null,
      customer_type: customer?.has_account ? "Registered" : "Guest",
      shipping_address_lines: [
        customerName,
        address?.address_1,
        address?.address_2,
        [address?.city, address?.province, address?.postal_code]
          .filter(Boolean)
          .join(", "),
        address?.country_code?.toUpperCase(),
        address?.phone,
      ].filter(Boolean) as string[],
      payment_method: paymentLabel(order),
      cod_paid:
        amounts.codUpfront > 0
          ? convertToLocale(amounts.codUpfront, cc)
          : undefined,
      cod_due:
        amounts.codUpfront > 0 ? convertToLocale(amounts.codDue, cc) : undefined,
      items: (order.items || []).map((item: any) => ({
        title: item.title,
        variant: item.variant_title,
        sku: item.variant_sku,
        quantity: item.quantity,
        price: convertToLocale(item.unit_price * item.quantity, cc),
      })),
      subtotal: convertToLocale(amounts.subtotal, cc),
      shipping:
        amounts.shipping > 0 ? convertToLocale(amounts.shipping, cc) : "Free",
      discount:
        amounts.discount > 0
          ? `−${convertToLocale(amounts.discount, cc)}`
          : undefined,
      total: convertToLocale(amounts.total, cc),
      admin_url: adminBase ? `${adminBase}/app/orders/${order.id}` : null,
    })
  } catch (e: any) {
    logger.warn(
      `Shop order notification failed for order ${order.id}: ${e?.message}`
    )
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
        "created_at",
        "currency_code",
        "total",
        "tax_total",
        "discount_total",
        "metadata",
        "items.*",
        "items.product.handle",
        // Read for the shop's own copy of the order: which exact variant, and
        // the SKU the packing team picks by.
        "items.variant_title",
        "items.variant_sku",
        "payment_collections.payments.provider_id",
        "shipping_address.*",
        "customer.id",
        "customer.has_account",
        "customer.first_name",
        "customer.last_name",
        "customer.phone",
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

    // Guest checkout only ever creates the Customer record with an email
    // (Medusa core's findOrCreateCustomerStep) — backfill name/phone from the
    // shipping address so guest customers show up correctly in Admin.
    const customer = (order as any).customer
    if (customer && !customer.has_account) {
      const address = order.shipping_address
      const customerPatch: Record<string, any> = {}
      if (!customer.first_name && address?.first_name) {
        customerPatch.first_name = address.first_name
      }
      if (!customer.last_name && address?.last_name) {
        customerPatch.last_name = address.last_name
      }
      if (!customer.phone && address?.phone) {
        customerPatch.phone = address.phone
      }
      if (Object.keys(customerPatch).length > 0) {
        try {
          const customerModule: any = container.resolve(Modules.CUSTOMER)
          await customerModule.updateCustomers(customer.id, customerPatch)
        } catch (e: any) {
          logger.warn(
            `Could not backfill guest customer ${customer.id} details: ${e?.message}`
          )
        }
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

    await sendShopNotification(emailService, order, {
      subtotal: subtotalNum,
      shipping: shippingNum,
      discount: discountNum,
      total: totalNum,
      codUpfront,
      codDue: codDueNum,
      logger,
    })
  } catch (error: any) {
    logger.error(`Order placed email failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
