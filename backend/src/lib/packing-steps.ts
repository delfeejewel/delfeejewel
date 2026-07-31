/**
 * The dispatch hierarchy — one definition, used by every packing endpoint and
 * by the order-page widget.
 *
 * Each step maps to a physical action on the packing bench, and doing them out
 * of order causes real failures: a box taped shut before the invoice goes in, a
 * label printed for a courier that was later reassigned, a van called for a
 * parcel nobody has packed. So the order is enforced HERE, server-side, and the
 * UI merely reflects it — a packer with the browser console open must not be
 * able to skip a step.
 *
 * Two kinds of step:
 *   - ATTESTATION (checkbox): the packer asserts a physical fact. No side
 *     effect beyond recording it. Reversible, and unticking cascades.
 *   - ACTION (button): calls Medusa, Shiprocket or a printer. Costs something —
 *     an AWB debits the wallet, a pickup request dispatches a van. Not
 *     reversible by unticking; undo is an explicit reset.
 */

export type StepId =
  | "started"
  | "items_packed"
  | "gift_wrapped"
  | "awb_assigned"
  | "label_printed"
  | "label_pasted"
  | "invoice_printed"
  | "invoice_added"
  | "parcel_sealed"
  | "ready_to_ship"
  | "handed_over"

export type StepKind = "action" | "attestation"

type StepDef = {
  id: StepId
  kind: StepKind
  label: string
  /** Everything that must be done before this step may be performed. */
  requires: StepId[]
  /** Steps that only apply to some orders (e.g. gift wrap). */
  conditional?: boolean
}

/** Ordered. Index in this array IS the hierarchy. */
export const PACKING_STEPS: StepDef[] = [
  { id: "started", kind: "action", label: "Start packing", requires: [] },
  { id: "items_packed", kind: "attestation", label: "Pick & verify items", requires: ["started"] },
  { id: "gift_wrapped", kind: "attestation", label: "Gift wrap applied", requires: ["items_packed"], conditional: true },
  { id: "awb_assigned", kind: "action", label: "Assign courier", requires: ["items_packed", "gift_wrapped"] },
  { id: "label_printed", kind: "action", label: "Print label", requires: ["awb_assigned"] },
  { id: "label_pasted", kind: "attestation", label: "Label pasted on parcel", requires: ["label_printed"] },
  { id: "invoice_printed", kind: "action", label: "Print invoice", requires: ["label_pasted"] },
  { id: "invoice_added", kind: "attestation", label: "Invoice in the box", requires: ["invoice_printed"] },
  { id: "parcel_sealed", kind: "attestation", label: "Parcel sealed", requires: ["invoice_added"] },
  { id: "ready_to_ship", kind: "action", label: "Ready to ship & call pickup", requires: ["parcel_sealed"] },
  { id: "handed_over", kind: "attestation", label: "Handed to courier", requires: ["ready_to_ship"] },
]

/** Checkbox steps, in order. Everything else is a button. */
export const ATTESTATION_STEPS = PACKING_STEPS.filter(
  (s) => s.kind === "attestation"
).map((s) => s.id)

const STEP_INDEX = new Map(PACKING_STEPS.map((s, i) => [s.id, i]))

export type PackingState = {
  fulfillment_id?: string
  started_at?: string | null
  packed_item_ids?: string[]
  gift_wrappers_used?: number | null
  /** Attestation timestamps, keyed by step id. */
  attestations?: Partial<Record<StepId, string>>
  invoice_printed_at?: string | null
  invoice_added_at?: string | null
  ready_to_ship_at?: string | null
  pickup_requested_at?: string | null
  history?: any[]
}

export type EvaluateInput = {
  /** Every line item id on the order that must be physically picked. */
  itemIds: string[]
  /** True when the order includes the gift-wrap add-on. */
  giftWrap: boolean
  packing: PackingState | null | undefined
  /** Shiprocket data off the fulfillment. */
  fulfillmentData?: { awb_code?: string | null } | null
  labelUrl?: string | null
}

export type StepStatus = {
  id: StepId
  kind: StepKind
  label: string
  applicable: boolean
  done: boolean
  at: string | null
  /** Null when the step may be performed now; otherwise why it can't be. */
  blockedBy: string | null
}

/**
 * Current state of every step for one order.
 *
 * `done` is derived from real evidence wherever possible — an AWB on the
 * fulfillment, a label url, every item ticked — rather than from a flag we set
 * ourselves. A flag can drift from reality; the AWB either exists or it doesn't.
 */
export function evaluatePacking(input: EvaluateInput): {
  steps: StepStatus[]
  nextStep: StepId | null
  complete: boolean
} {
  const p = input.packing || {}
  const att = p.attestations || {}

  const allItemsPacked =
    input.itemIds.length > 0 &&
    input.itemIds.every((id) => (p.packed_item_ids || []).includes(id))

  const doneMap: Record<StepId, string | null> = {
    started: p.started_at ?? null,
    items_packed: allItemsPacked ? att.items_packed ?? p.started_at ?? null : null,
    gift_wrapped: att.gift_wrapped ?? null,
    awb_assigned: input.fulfillmentData?.awb_code ? att.awb_assigned ?? "recorded" : null,
    label_printed: input.labelUrl ? att.label_printed ?? "recorded" : null,
    label_pasted: att.label_pasted ?? null,
    invoice_printed: p.invoice_printed_at ?? null,
    invoice_added: p.invoice_added_at ?? att.invoice_added ?? null,
    parcel_sealed: att.parcel_sealed ?? null,
    ready_to_ship: p.ready_to_ship_at ?? null,
    handed_over: att.handed_over ?? null,
  }

  const applicable = (id: StepId): boolean => {
    if (id === "gift_wrapped") return input.giftWrap
    return true
  }

  const steps: StepStatus[] = PACKING_STEPS.map((def) => {
    const isApplicable = applicable(def.id)
    const at = doneMap[def.id]
    const done = isApplicable ? !!at : true // a step that doesn't apply never blocks

    const missing = def.requires
      .filter((r) => applicable(r) && !doneMap[r])
      .map((r) => PACKING_STEPS.find((s) => s.id === r)!.label)

    return {
      id: def.id,
      kind: def.kind,
      label: def.label,
      applicable: isApplicable,
      done: isApplicable ? !!at : false,
      at: typeof at === "string" && at !== "recorded" ? at : at ? null : null,
      blockedBy: done || !isApplicable ? null : missing.length ? missing.join(", ") : null,
    }
  })

  const next =
    steps.find((s) => s.applicable && !s.done && !s.blockedBy)?.id ?? null

  const complete = steps.every((s) => !s.applicable || s.done)

  return { steps, nextStep: next, complete }
}

/**
 * Can this step be performed right now? Returns null when yes, or the reason
 * when no. Every mutating endpoint calls this before doing anything.
 */
export function assertStepAllowed(
  step: StepId,
  input: EvaluateInput
): string | null {
  const def = PACKING_STEPS.find((s) => s.id === step)
  if (!def) return `Unknown step "${step}"`

  const { steps } = evaluatePacking(input)
  const status = steps.find((s) => s.id === step)!

  if (!status.applicable) return `"${def.label}" does not apply to this order`
  if (status.blockedBy) return `Do this first: ${status.blockedBy}`
  return null
}

/**
 * Unticking a checkbox invalidates everything after it.
 *
 * Without this an order can sit in a state where a later gate is satisfied but
 * the reason it opened is gone — "sealed" ticked while "items packed" is not.
 * Returns the attestations to clear.
 */
export function cascadeFrom(step: StepId): StepId[] {
  const from = STEP_INDEX.get(step)
  if (from === undefined) return []
  return PACKING_STEPS.filter(
    (s, i) => i > from && s.kind === "attestation"
  ).map((s) => s.id)
}
