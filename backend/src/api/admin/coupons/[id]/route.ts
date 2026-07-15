import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { actorHasPermission } from "../../../../lib/rbac"

const ERR = (res: MedusaResponse, status: number, message: string) =>
  res.status(status).json({ message })

/**
 * POST /admin/coupons/:id — enable/disable a coupon.
 * Body: { status: "active" | "inactive" }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!(await actorHasPermission(req, "promotions.write"))) {
    return ERR(res, 403, "Access denied. Promotions permission required.")
  }
  const id = req.params.id
  const { status } = (req.body || {}) as { status?: string }
  if (status !== "active" && status !== "inactive") {
    return ERR(res, 400, 'status must be "active" or "inactive".')
  }

  const promoModule: any = req.scope.resolve(Modules.PROMOTION)
  const [promo] = await promoModule.listPromotions({ id })
  if (!promo) return ERR(res, 404, "Coupon not found.")

  await promoModule.updatePromotions([{ id, status }])
  return res.json({ ok: true, status })
}

/**
 * DELETE /admin/coupons/:id — permanently remove a coupon.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  if (!(await actorHasPermission(req, "promotions.write"))) {
    return ERR(res, 403, "Access denied. Promotions permission required.")
  }
  const id = req.params.id
  const promoModule: any = req.scope.resolve(Modules.PROMOTION)

  const [promo] = await promoModule.listPromotions({ id })
  if (!promo) return ERR(res, 404, "Coupon not found.")

  await promoModule.deletePromotions([id])
  return res.json({ id, deleted: true })
}
