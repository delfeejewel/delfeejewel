import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export type CustomerSegment = "new" | "repeat" | "regular"

export type SegmentedCustomer = {
  customer_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  completed_order_count: number
  segment: CustomerSegment
  last_order_at: string | null
  total_spent: number
}

export function segmentFromOrderCount(count: number): CustomerSegment {
  if (count <= 1) return "new"
  if (count <= 3) return "repeat"
  return "regular"
}

/**
 * Builds a per-customer segmentation view by aggregating non-canceled orders.
 * Read-time aggregation — no persisted segment field.
 */
export async function computeCustomerSegments(
  container: MedusaContainer
): Promise<SegmentedCustomer[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "email",
      "total",
      "created_at",
      "canceled_at",
      "customer.first_name",
      "customer.last_name",
    ],
  })

  const byCustomer = new Map<string, SegmentedCustomer>()

  for (const o of (orders as any[]) || []) {
    if (o.canceled_at) continue
    const cid: string | null = o.customer_id
    if (!cid) continue

    const existing = byCustomer.get(cid)
    const createdAt: string | null = o.created_at || null
    const total = Number(o.total || 0)

    if (existing) {
      existing.completed_order_count += 1
      existing.total_spent += total
      if (
        createdAt &&
        (!existing.last_order_at ||
          new Date(createdAt).getTime() >
            new Date(existing.last_order_at).getTime())
      ) {
        existing.last_order_at = createdAt
      }
    } else {
      byCustomer.set(cid, {
        customer_id: cid,
        email: o.email || null,
        first_name: o.customer?.first_name || null,
        last_name: o.customer?.last_name || null,
        completed_order_count: 1,
        segment: "new",
        last_order_at: createdAt,
        total_spent: total,
      })
    }
  }

  for (const c of byCustomer.values()) {
    c.segment = segmentFromOrderCount(c.completed_order_count)
  }

  return Array.from(byCustomer.values())
}

export function tallySegments(rows: SegmentedCustomer[]) {
  const totals = { new: 0, repeat: 0, regular: 0 }
  for (const r of rows) totals[r.segment] += 1
  return totals
}
