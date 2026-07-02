import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

import { MARKETING_MODULE } from "../modules/marketing"
import { computeCustomerSegments } from "./segmentation"

export type Recipient = { email: string; name?: string }

const norm = (e?: string | null) => (e || "").toLowerCase().trim()

/**
 * Resolve a campaign's audience into a deduped recipient list, with the
 * suppression list (unsubscribed newsletter rows) removed — even for segment /
 * all-customer sends, so anyone who ever unsubscribed is never re-mailed.
 */
export async function resolveRecipients(
  container: MedusaContainer,
  campaign: {
    audience_type: string
    audience_segment?: string | null
  }
): Promise<Recipient[]> {
  const marketing: any = container.resolve(MARKETING_MODULE)

  // Suppression list — every email that has unsubscribed.
  const unsubRows = await marketing.listNewsletterSubscribers({
    status: "unsubscribed",
  })
  const suppressed = new Set<string>(
    (unsubRows || []).map((r: any) => norm(r.email))
  )

  const byEmail = new Map<string, Recipient>()
  const add = (email?: string | null, name?: string) => {
    const e = norm(email)
    if (!e || suppressed.has(e) || byEmail.has(e)) return
    byEmail.set(e, { email: e, name })
  }

  const wantSubscribers =
    campaign.audience_type === "subscribers" ||
    campaign.audience_type === "everyone"
  const wantAllCustomers =
    campaign.audience_type === "all_customers" ||
    campaign.audience_type === "everyone"
  const wantSegment = campaign.audience_type === "segment"

  if (wantSubscribers) {
    const subs = await marketing.listNewsletterSubscribers({
      status: "subscribed",
    })
    for (const s of subs || []) add(s.email)
  }

  if (wantSegment && campaign.audience_segment) {
    const segmented = await computeCustomerSegments(container)
    for (const c of segmented) {
      if (c.segment === campaign.audience_segment) {
        add(c.email, [c.first_name, c.last_name].filter(Boolean).join(" "))
      }
    }
  }

  if (wantAllCustomers) {
    const customerModule: any = container.resolve(Modules.CUSTOMER)
    // Page through customers so large stores aren't truncated.
    const take = 1000
    let offset = 0
    for (;;) {
      const batch = await customerModule.listCustomers(
        {},
        { take, skip: offset, select: ["email", "first_name", "last_name"] }
      )
      for (const c of batch || []) {
        add(c.email, [c.first_name, c.last_name].filter(Boolean).join(" "))
      }
      if (!batch || batch.length < take) break
      offset += take
    }
  }

  return Array.from(byEmail.values())
}
