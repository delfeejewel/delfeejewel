import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Auto-capture the online payment when an order is placed.
 *
 * Razorpay's account auto-captures the money at pay time, but our provider's
 * authorizePayment only marks the Medusa session AUTHORIZED — so the order shows
 * "unpaid / ready to capture" until an admin clicks Capture. This syncs Medusa's
 * ledger to reality automatically so every online order reads as PAID on arrival.
 *
 * This moves NO additional money: Razorpay has already captured, so the capture
 * call is a no-op on the gateway (see razorpay service.capturePayment) — it only
 * records the capture on Medusa's side. Fulfilment stays MANUAL; this touches
 * payment only, never shipping.
 *
 * Safety:
 *  - Only captures payments whose provider is Razorpay. COD orders collect the
 *    balance on delivery, so their order-level payment must NOT be captured here.
 *  - Idempotent: skips payments already captured or canceled.
 */
export default async function orderAutoCaptureHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "payment_collections.payments.id",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { id: data.id },
    })

    if (!order) return

    const capturable = ((order as any).payment_collections || [])
      .flatMap((pc: any) => pc?.payments || [])
      .filter(
        (p: any) =>
          p &&
          !p.captured_at &&
          !p.canceled_at &&
          typeof p.provider_id === "string" &&
          p.provider_id.toLowerCase().includes("razorpay")
      )

    for (const p of capturable) {
      try {
        await capturePaymentWorkflow(container).run({
          input: { payment_id: p.id },
        })
        logger.info(
          `Auto-captured payment ${p.id} for order #${(order as any).display_id}`
        )
      } catch (e: any) {
        // Non-fatal: the payment stays AUTHORIZED and an admin can capture it by
        // hand. Better to log loudly than to fail order placement.
        logger.error(
          `Auto-capture failed for payment ${p.id} on order #${(order as any).display_id}: ${e?.message}`
        )
      }
    }
  } catch (error: any) {
    logger.error(`Order auto-capture failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
