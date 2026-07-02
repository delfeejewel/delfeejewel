import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { MARKETING_MODULE } from "../../../../modules/marketing"

/**
 * GET /admin/newsletter/subscribers?status=&limit=&offset=
 * Lists newsletter subscribers with counts for the admin subscribers view.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const marketing: any = req.scope.resolve(MARKETING_MODULE)
  const status = req.query.status as string | undefined
  const limit = Math.min(Number(req.query.limit) || 100, 200)
  const offset = Number(req.query.offset) || 0

  const filters: Record<string, any> = {}
  if (status === "subscribed" || status === "unsubscribed") filters.status = status

  const [rows, count] = await marketing.listAndCountNewsletterSubscribers(
    filters,
    { order: { created_at: "DESC" }, take: limit, skip: offset }
  )

  const subscribed = await marketing.listNewsletterSubscribers({ status: "subscribed" })
  const unsubscribed = await marketing.listNewsletterSubscribers({ status: "unsubscribed" })

  return res.json({
    subscribers: rows,
    count,
    totals: {
      subscribed: subscribed.length,
      unsubscribed: unsubscribed.length,
    },
  })
}
