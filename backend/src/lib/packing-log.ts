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
  return [...history, { at: new Date().toISOString(), ...entry }]
}
