import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Per-category navigation visibility.
 *
 * Controls which storefront surfaces a category appears on. Mirrors the
 * storefront's lib/util/category-visibility — keep the key names in sync.
 *
 * Semantics are opt-OUT: a missing key means visible. Only an explicit `false`
 * hides the category, so categories predating this feature keep showing
 * everywhere. We therefore persist real booleans and never "normalise" an
 * absent flag to false.
 */

const SURFACE_KEYS = [
  "show_in_header",
  "show_in_mobile",
  "show_in_footer",
  "show_in_tiles",
] as const

type SurfaceKey = (typeof SURFACE_KEYS)[number]

/** Merge into existing metadata — assigning a bare object wipes sibling keys. */
async function patchCategoryMetadata(
  req: MedusaRequest,
  id: string,
  patch: Record<string, unknown>
) {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const existing: any = await productModuleService
    .retrieveProductCategory(id)
    .catch(() => null)
  const metadata = {
    ...((existing?.metadata as Record<string, unknown>) || {}),
    ...patch,
  }
  await productModuleService.updateProductCategories(id, { metadata })
  return metadata
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { id } = req.params
    const body = (req.body || {}) as Record<string, unknown>

    const patch: Partial<Record<SurfaceKey, boolean>> = {}
    for (const key of SURFACE_KEYS) {
      if (!(key in body)) {
        continue
      }
      if (typeof body[key] !== "boolean") {
        return res
          .status(400)
          .json({ message: `"${key}" must be a boolean if provided` })
      }
      patch[key] = body[key] as boolean
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({
        message: `Provide at least one of: ${SURFACE_KEYS.join(", ")}`,
      })
    }

    // `show_in_tiles` supersedes the original single-purpose
    // `hide_from_homepage`. Clear the old key whenever tiles are set, so the
    // two can't disagree and strand a category off the homepage forever.
    if ("show_in_tiles" in patch) {
      ;(patch as Record<string, unknown>).hide_from_homepage = null
    }

    const metadata = await patchCategoryMetadata(req, id, patch)

    return res.json({
      metadata,
      message: "Navigation visibility updated",
    })
  } catch (error: any) {
    console.error("Category nav-visibility error:", error)
    return res.status(500).json({ message: error.message })
  }
}
