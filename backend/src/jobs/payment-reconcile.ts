import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { capturePaymentWorkflow } from "@medusajs/medusa/core-flows"

/** How far back to look. Older than this, a stuck payment is a manual job. */
const LOOKBACK_DAYS = Number(process.env.PAYMENT_RECONCILE_DAYS || 30)

const isRazorpay = (providerId?: string | null) =>
  typeof providerId === "string" && providerId.toLowerCase().includes("razorpay")

/**
 * Reach the Razorpay provider instance.
 *
 * `container.resolve("pp_razorpay_razorpay")` looks right but isn't reachable —
 * the payment module keeps provider instances in its own container. Same
 * situation as the Shiprocket provider (see lib/shiprocket-provider.ts); the
 * way in is the module service's own provider registry.
 */
function resolveRazorpayProvider(container: MedusaContainer, providerId: string) {
  const paymentModule: any = container.resolve(Modules.PAYMENT)
  return paymentModule.paymentProviderService_.retrieveProvider(providerId)
}

/**
 * Daily sweep for online payments that Medusa still shows as unpaid.
 *
 * `order-auto-capture` records the capture when the order is placed, and the
 * Razorpay webhook covers checkouts the browser abandoned. Neither is
 * guaranteed: a webhook can be dropped, a deploy can land mid-checkout, the
 * capture call can fail. What's left is an order whose money Razorpay took days
 * ago but which reads "Awaiting payment" in Admin — so it doesn't get packed,
 * and the ledger disagrees with the bank.
 *
 * For every uncaptured Razorpay payment in the window this asks Razorpay what
 * actually happened:
 *  - captured / authorized at Razorpay → record the capture, the order flips to
 *    PAID in Admin. Moves no money: Razorpay already has it, so the provider's
 *    capture call is a no-op on the gateway.
 *  - failed → left alone. The customer genuinely didn't pay.
 *  - can't tell (no Razorpay id on the payment, or the API errored) → stamped on
 *    the order as `payment_reconcile` for a human, never silently "fixed".
 */
export default async function paymentReconcileJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  let checked = 0
  let captured = 0
  let stillUnpaid = 0
  const unresolved: string[] = []

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "metadata",
        "payment_collections.payments.id",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
        "payment_collections.payments.data",
      ],
      filters: { created_at: { $gte: since } } as any,
    })

    for (const order of (orders as any[]) || []) {
      const pending = ((order.payment_collections as any[]) || [])
        .flatMap((pc: any) => pc?.payments || [])
        .filter(
          (p: any) =>
            p && !p.captured_at && !p.canceled_at && isRazorpay(p.provider_id)
        )

      for (const payment of pending) {
        checked++
        const rpId = (payment.data as any)?.razorpay_payment_id

        if (!rpId) {
          // Nothing to ask Razorpay about — an authorize that never completed.
          unresolved.push(`#${order.display_id}: no razorpay_payment_id`)
          await stampReview(container, order, payment.id, "no_razorpay_id", logger)
          continue
        }

        let status: string | undefined
        try {
          const provider = resolveRazorpayProvider(container, payment.provider_id)
          const res = await provider.retrievePayment({ data: payment.data })
          status = res?.data?.payment_details?.status
        } catch (e: any) {
          unresolved.push(`#${order.display_id}: lookup failed (${e?.message})`)
          await stampReview(container, order, payment.id, "lookup_failed", logger)
          continue
        }

        if (status === "captured" || status === "authorized") {
          try {
            await capturePaymentWorkflow(container).run({
              input: { payment_id: payment.id },
            })
            captured++
            logger.info(
              `Payment reconcile: order #${order.display_id} was paid at Razorpay ` +
                `(${rpId}, ${status}) but showed unpaid — recorded the capture.`
            )
          } catch (e: any) {
            unresolved.push(`#${order.display_id}: capture failed (${e?.message})`)
            await stampReview(container, order, payment.id, "capture_failed", logger)
          }
          continue
        }

        // "failed" / "created" — the money isn't there. Leave it alone.
        stillUnpaid++
      }
    }

    logger.info(
      `Payment reconcile: ${checked} uncaptured payment(s) checked over ${LOOKBACK_DAYS}d — ` +
        `${captured} settled and marked paid, ${stillUnpaid} genuinely unpaid, ` +
        `${unresolved.length} need a human.`
    )
    for (const u of unresolved) {
      logger.warn(`Payment reconcile: ${u}`)
    }
  } catch (e: any) {
    logger.error(`Payment reconcile job failed: ${e?.message}`)
  }
}

/**
 * Record on the order that this payment couldn't be reconciled automatically.
 *
 * Deliberately additive and best-effort — the stamp is a breadcrumb for whoever
 * investigates, and failing to write it must not abort the sweep.
 */
async function stampReview(
  container: MedusaContainer,
  order: any,
  paymentId: string,
  reason: string,
  logger: any
) {
  try {
    const orderModule: any = container.resolve(Modules.ORDER)
    await orderModule.updateOrders([
      {
        id: order.id,
        metadata: {
          ...((order.metadata as any) || {}),
          payment_reconcile: {
            status: "needs_review",
            reason,
            payment_id: paymentId,
            checked_at: new Date().toISOString(),
          },
        },
      },
    ])
  } catch (e: any) {
    logger.warn(
      `Payment reconcile: could not stamp order ${order.id}: ${e?.message}`
    )
  }
}

export const config = {
  name: "payment-reconcile",
  // 03:30 UTC = 09:00 IST. The container runs UTC, so a literal "0 9 * * *"
  // would fire at 2:30pm in Chandigarh.
  schedule: "30 3 * * *",
}
