import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Inspect / set per-category navigation visibility, and migrate the legacy
 * `hide_from_homepage` key onto the new `show_in_tiles` flag.
 *
 *   # show every category and where it appears
 *   npx medusa exec ./src/scripts/set-category-nav-visibility.ts
 *
 *   # migrate legacy hide_from_homepage -> show_in_tiles (dry run, then apply)
 *   npx medusa exec ./src/scripts/set-category-nav-visibility.ts migrate
 *   npx medusa exec ./src/scripts/set-category-nav-visibility.ts migrate apply
 *
 *   # set flags on one category
 *   npx medusa exec ./src/scripts/set-category-nav-visibility.ts \
 *     chains header=true mobile=true footer=true tiles=false apply
 *
 * Flags are opt-OUT: a missing key means visible. Only an explicit `false`
 * hides a category, so anything predating this feature shows everywhere.
 */

const SURFACES = {
  header: "show_in_header",
  mobile: "show_in_mobile",
  footer: "show_in_footer",
  tiles: "show_in_tiles",
} as const

type Surface = keyof typeof SURFACES

const hasCover = (m: Record<string, unknown>) =>
  typeof m.cover_image === "string" && (m.cover_image as string).trim() !== ""

/** What the storefront will actually do, legacy key and cover rule included. */
const effective = (m: Record<string, unknown>, s: Surface) => {
  if (s === "tiles") {
    if (m.hide_from_homepage === true) return "hidden (legacy flag)"
    if (m[SURFACES[s]] === false) return "hidden"
    return hasCover(m) ? "shown" : "hidden (no cover image)"
  }
  return m[SURFACES[s]] === false ? "hidden" : "shown"
}

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModuleService = container.resolve(Modules.PRODUCT)

  const apply = args.includes("apply")
  const migrate = args.includes("migrate")
  const rest = args.filter((a) => a !== "apply" && a !== "migrate")

  const assignments = rest.filter((a) => a.includes("="))
  const handleArg = rest.find((a) => !a.includes("="))

  const { data: cats } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "rank", "metadata"],
  })
  const categories = (cats as any[]).sort((a, b) => a.rank - b.rank)

  const patchMetadata = async (cat: any, patch: Record<string, unknown>) => {
    await productModuleService.updateProductCategories(cat.id, {
      metadata: { ...((cat.metadata as Record<string, unknown>) || {}), ...patch },
    })
  }

  // ---- migrate legacy key ------------------------------------------------
  if (migrate) {
    const legacy = categories.filter(
      (c) => ((c.metadata || {}) as any).hide_from_homepage === true
    )
    logger.info(
      apply ? "--- MIGRATING ---" : "--- DRY RUN (pass `apply`) ---"
    )
    if (!legacy.length) {
      logger.info("No categories still use hide_from_homepage — nothing to do.")
      return
    }
    for (const c of legacy) {
      logger.info(
        `  ${c.handle}: hide_from_homepage=true -> show_in_tiles=false (key cleared)`
      )
      if (apply) {
        await patchMetadata(c, { show_in_tiles: false, hide_from_homepage: null })
      }
    }
    logger.info(apply ? "Done." : "Dry run complete — nothing written.")
    return
  }

  // ---- set flags on one category ----------------------------------------
  if (handleArg) {
    const cat = categories.find((c) => c.handle === handleArg)
    if (!cat) {
      logger.error(
        `No category with handle "${handleArg}". Available: ` +
          categories.map((c) => c.handle).join(", ")
      )
      return
    }
    if (!assignments.length) {
      logger.error(
        `Nothing to set. Use e.g. tiles=false (surfaces: ${Object.keys(SURFACES).join(", ")})`
      )
      return
    }

    const patch: Record<string, unknown> = {}
    for (const a of assignments) {
      const [rawKey, rawValue] = a.split("=")
      const key = rawKey.trim() as Surface
      if (!(key in SURFACES)) {
        logger.error(
          `Unknown surface "${rawKey}". Valid: ${Object.keys(SURFACES).join(", ")}`
        )
        return
      }
      const value = rawValue?.trim().toLowerCase()
      if (value !== "true" && value !== "false") {
        logger.error(`"${a}" must be ${key}=true or ${key}=false`)
        return
      }
      patch[SURFACES[key]] = value === "true"
      if (key === "tiles") patch.hide_from_homepage = null
    }

    logger.info(apply ? "--- APPLYING ---" : "--- DRY RUN (pass `apply`) ---")
    logger.info(`${cat.name} (${cat.handle}): ${JSON.stringify(patch)}`)
    if (apply) {
      await patchMetadata(cat, patch)
      logger.info("Done.")
    } else {
      logger.info("Dry run complete — nothing written.")
    }
    return
  }

  // ---- default: report ---------------------------------------------------
  const surfaces = Object.keys(SURFACES) as Surface[]
  logger.info("Category visibility (what the storefront will render):")
  for (const c of categories) {
    const m = (c.metadata || {}) as Record<string, unknown>
    const cells = surfaces
      .map((s) => `${s}=${effective(m, s)}`)
      .join("  ")
    logger.info(`  ${c.handle.padEnd(18)} ${cells}`)
  }
}
