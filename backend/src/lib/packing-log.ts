import { Modules } from "@medusajs/framework/utils"

/**
 * Resolves the acting admin user's id + email for an audit-trail entry.
 * Falls back to nulls for system-triggered actions (e.g. the Shiprocket
 * webhook), which callers label separately (see SYSTEM_ACTOR below).
 */
export async function resolveActor(
  scope: any,
  authContext: any
): Promise<{ actor_id: string | null; actor_email: string | null }> {
  const actorId = authContext?.actor_id || null
  let actorEmail: string | null = null
  if (actorId) {
    try {
      const userModule: any = scope.resolve(Modules.USER)
      const [u] = await userModule.listUsers({ id: actorId })
      actorEmail = u?.email || null
    } catch {
      // Leave email null — the id alone still identifies who did this.
    }
  }
  return { actor_id: actorId, actor_email: actorEmail }
}

/** Used when a step is triggered by the Shiprocket webhook, not a logged-in user. */
export const SYSTEM_ACTOR = { actor_id: null, actor_email: "Shiprocket (automatic)" }

/**
 * Steps worth recording once, not once per press.
 *
 * Reprinting a label or an invoice is routine — a jam, a smudge, a second copy
 * — and each press used to add a line, so a log could carry five identical
 * "Printed the shipping label" rows and bury the events that matter. The first
 * one is the fact; the repeats aren't news.
 */
const LOG_ONCE = new Set(["label_printed", "invoice_printed"])

/**
 * Steps that begin a fresh dispatch attempt. After one of these the label and
 * invoice are genuinely printed again — for a new AWB — so "once" is once per
 * attempt, not once for the life of the order. Without this, a reprint after a
 * reset would go unrecorded, which is the opposite of the problem.
 */
const ATTEMPT_MARKERS = new Set([
  "shipment_reset",
  "restarted_after_cancel",
  "shiprocket_order_created",
  "awb_changed",
])

/** Appends one timestamped, attributed entry to a packing session's audit trail. */
export function appendPackingHistory(
  packing: any,
  entry: {
    step: string
    actor_id: string | null
    actor_email: string | null
    [key: string]: any
  }
): any[] {
  const history = Array.isArray(packing?.history) ? packing.history : []

  if (LOG_ONCE.has(entry.step)) {
    const lastAttemptStart = history.reduce(
      (idx: number, h: any, i: number) =>
        ATTEMPT_MARKERS.has(h?.step) ? i : idx,
      -1
    )
    const alreadyLogged = history
      .slice(lastAttemptStart + 1)
      .some((h: any) => h?.step === entry.step)
    if (alreadyLogged) return history
  }

  return [...history, { at: new Date().toISOString(), ...entry }]
}
