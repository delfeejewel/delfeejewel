import { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { buildFraudContext } from "../lib/fraud-context"
import { scoreOrder, getFraudConfig } from "../lib/fraud"

/**
 * On order.placed: score the order for fraud risk and stamp the result on
 * order.metadata. Orders scoring at/above the review threshold are flagged
 * `fraud_status: needs_review` and surface in the admin "Orders to Review"
 * queue. This NEVER blocks or cancels — it only annotates for a human.
 *
 * Fully isolated in try/catch so a scoring failure can never disrupt order
 * placement, email, or any other order.placed handler.
 */
export default async function orderFraudCheckHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const ctx = await buildFraudContext(container, data.id)
    if (!ctx) return

    const config = getFraudConfig()
    const { score, band, reasons, rules } = scoreOrder(ctx, config)

    const flagged = score >= config.scoreReview

    const orderModule: any = container.resolve(Modules.ORDER)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [existing] } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: data.id },
    })
    const prevMeta = ((existing as any)?.metadata as any) || {}

    await orderModule.updateOrders([
      {
        id: data.id,
        metadata: {
          ...prevMeta,
          fraud_score: score,
          fraud_band: band,
          fraud_reasons: reasons,
          fraud_rules: rules,
          fraud_status: flagged ? "needs_review" : "clear",
          fraud_checked_at: new Date().toISOString(),
        },
      },
    ])

    if (flagged) {
      logger.warn(
        `Fraud check: order ${data.id} scored ${score} (${band}) — flagged for review. Reasons: ${reasons.join("; ")}`
      )
    } else {
      logger.info(`Fraud check: order ${data.id} scored ${score} (${band}).`)
    }
  } catch (error: any) {
    logger.error(`Fraud check failed for order ${data.id}: ${error?.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
