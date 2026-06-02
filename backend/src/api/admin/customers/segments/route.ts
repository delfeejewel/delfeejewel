import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  computeCustomerSegments,
  tallySegments,
  type CustomerSegment,
} from "../../../../lib/segmentation"

const VALID_SEGMENTS = new Set<CustomerSegment>(["new", "repeat", "regular"])

/**
 * GET /admin/customers/segments
 *   ?segment=new|repeat|regular   filter list to a single bucket
 *   ?limit=50&offset=0            pagination over the (optionally filtered) list
 *
 * Always returns `totals` across all buckets so the UI can show distribution
 * even when paginating into a single segment.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  try {
    const segment = req.query.segment as string | undefined
    if (segment && !VALID_SEGMENTS.has(segment as CustomerSegment)) {
      return res.status(400).json({
        message: `Invalid segment "${segment}". Expected one of: new, repeat, regular.`,
      })
    }

    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50))
    const offset = Math.max(0, Number(req.query.offset) || 0)

    const all = await computeCustomerSegments(req.scope as any)
    const totals = tallySegments(all)

    const filtered = segment
      ? all.filter((c) => c.segment === segment)
      : all

    filtered.sort((a, b) => {
      const aT = a.last_order_at ? new Date(a.last_order_at).getTime() : 0
      const bT = b.last_order_at ? new Date(b.last_order_at).getTime() : 0
      return bT - aT
    })

    const customers = filtered.slice(offset, offset + limit)

    return res.json({
      totals,
      count: filtered.length,
      customers,
    })
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Failed to compute segments" })
  }
}
