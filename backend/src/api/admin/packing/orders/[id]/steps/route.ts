import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { actorHasPermission } from "../../../../../../lib/rbac"
import {
  ATTESTATION_STEPS,
  assertStepAllowed,
  cascadeFrom,
  evaluatePacking,
  type StepId,
} from "../../../../../../lib/packing-steps"

/**
 * POST /admin/packing/orders/:id/steps
 * Body: { step: StepId, done: boolean, gift_wrappers_used?: number }
 *
 * Records (or clears) a packer ATTESTATION — the checkbox steps: gift wrap
 * applied, label pasted, invoice in the box, parcel sealed, handed to courier.
 *
 * Action steps (assign courier, print, request pickup) are NOT handled here:
 * they live on their own endpoints because they call Shiprocket and cost
 * something. This route only records facts a human is asserting.
 *
 * The hierarchy is enforced here rather than in the UI. Unticking cascades:
 * clearing an early step clears every later attestation, so the order can never
 * sit in a state where a gate is open but the reason it opened is gone.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  if (!(await actorHasPermission(req, "shipping.write"))) {
    return res.status(403).json({ message: "Forbidden" })
  }

  const orderId = req.params.id
  const { step, done, gift_wrappers_used } = (req.body || {}) as {
    step?: StepId
    done?: boolean
    gift_wrappers_used?: number
  }

  if (!step || !ATTESTATION_STEPS.includes(step)) {
    return res.status(400).json({
      message: `step must be one of: ${ATTESTATION_STEPS.join(", ")}`,
    })
  }
  if (typeof done !== "boolean") {
    return res.status(400).json({ message: "done (boolean) is required" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const orderModule: any = req.scope.resolve(Modules.ORDER)

  const { data: orders } = await query.graph({
    entity: "order",
    filters: { id: orderId } as any,
    fields: [
      "id",
      "metadata",
      "items.*",
      "fulfillments.id",
      "fulfillments.data",
      "fulfillments.labels.*",
    ],
  })
  const order = (orders as any[])?.[0]
  if (!order) return res.status(404).json({ message: "Order not found" })

  const prevMeta = (order.metadata as any) || {}
  const packing = prevMeta.packing
  if (!packing?.fulfillment_id) {
    return res
      .status(400)
      .json({ message: "Start packing before recording steps" })
  }

  const fulfillment = ((order.fulfillments as any[]) || []).find(
    (f) => f.id === packing.fulfillment_id
  )

  const items = (order.items as any[]) || []
  const giftWrap = items.some((i) => i.product_handle === "gift-wrap")

  const evalInput = {
    // Service lines (gift wrap, COD fee) are not physically picked.
    itemIds: items
      .filter((i) => !["gift-wrap", "cod-fee"].includes(i.product_handle))
      .map((i) => i.id),
    giftWrap,
    packing,
    fulfillmentData: fulfillment?.data,
    labelUrl: (fulfillment?.labels || [])[0]?.label_url ?? null,
  }

  // Ticking must respect the hierarchy. Unticking never does — you must always
  // be able to correct a mistake, and the cascade handles the consequences.
  if (done) {
    const blocked = assertStepAllowed(step, evalInput)
    if (blocked) return res.status(400).json({ message: blocked })
  }

  const attestations = { ...(packing.attestations || {}) }
  const history = Array.isArray(packing.history) ? packing.history : []
  const now = new Date().toISOString()

  const actorId = (req as any).auth_context?.actor_id ?? null
  const actorEmail = (req as any).auth_context?.app_metadata?.email ?? null

  let cleared: StepId[] = []

  if (done) {
    attestations[step] = now
  } else {
    delete attestations[step]
    cleared = cascadeFrom(step).filter((s) => attestations[s])
    for (const s of cleared) delete attestations[s]
  }

  history.push({
    step: done ? step : `${step}_undone`,
    at: now,
    actor_id: actorId,
    actor_email: actorEmail,
    ...(cleared.length ? { cascaded: cleared } : {}),
  })

  const nextPacking: any = { ...packing, attestations, history }

  if (step === "gift_wrapped" && done && typeof gift_wrappers_used === "number") {
    nextPacking.gift_wrappers_used = gift_wrappers_used
  }

  await orderModule.updateOrders([
    { id: orderId, metadata: { ...prevMeta, packing: nextPacking } },
  ])

  const state = evaluatePacking({ ...evalInput, packing: nextPacking })

  return res.json({
    ok: true,
    step,
    done,
    cascaded_cleared: cleared,
    ...state,
  })
}
