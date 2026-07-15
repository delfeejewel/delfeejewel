/**
 * Clean up copy on the 32 newly-added products to match the site convention:
 *   - de-accent "pavé" -> "pave" (title, subtitle, description)
 *   - remove hyphens from the SHORT description (subtitle) and description
 *     (hyphen -> space; en/em dashes normalised too). Titles keep their hyphens.
 *
 * Dry-run by default (prints before/after). Pass `apply` to write.
 *   npx medusa exec ./src/scripts/fix-new-product-copy.ts
 *   npx medusa exec ./src/scripts/fix-new-product-copy.ts apply
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const HANDLES = [
  // Necklaces & sets
  "tube-bead-station-cable-chain-necklace",
  "textured-rolo-link-chunky-chain-necklace",
  "rose-gold-lotus-floral-pendant-necklace-earring-set",
  "pave-fan-drop-collar-necklace-earring-set",
  "oxidised-temple-green-bead-pearl-necklace-earring-set",
  "pearl-strand-floral-jhumka-drop-necklace-earring-set",
  "blue-solitaire-feather-necklace-earring-set",
  "ruby-red-emerald-green-drop-necklace-earring-set",
  "mother-of-pearl-evil-eye-heart-necklace-earring-set",
  "emerald-cut-cz-leaf-vine-necklace-earring-set",
  "oval-crystal-halo-drop-leaf-necklace-earring-set",
  "purple-amethyst-asymmetric-collar-necklace-earring-set",
  // Mangalsutras
  "princess-cut-halo-single-line-mangalsutra",
  "twin-oval-halo-single-line-mangalsutra",
  "infinity-floral-cz-single-line-mangalsutra",
  "triple-oval-halo-single-line-mangalsutra",
  // Bracelets
  "two-tone-monogram-link-bracelet",
  "pave-cz-hexagon-link-bracelet",
  // Anklets
  "floral-cz-double-chain-anklets-ghungroo",
  "dainty-beaded-snake-chain-anklets",
  "infinity-love-cz-pave-anklets",
  "floating-pearl-station-anklets",
  "classic-rope-chain-anklets",
  "ruby-emerald-floral-cluster-statement-anklets",
  // Earrings
  "pave-line-huggie-hoop-earrings",
  "navratna-teardrop-statement-studs",
  "emerald-star-chain-drop-earrings",
  "star-stud-hexagon-long-chain-drops",
  "filigree-cone-pearl-green-bead-drops",
  "polished-dome-chunky-hoop-earrings",
  "sapphire-fan-chandelier-earrings",
  "filigree-dome-pearl-garnet-drops",
]

// pavé -> pave (and any stray accents on that word)
const deAccent = (s: string): string =>
  s.replace(/é/g, "e").replace(/É/g, "E")

// de-accent + strip hyphens (hyphen -> space; spaced en/em dash -> comma)
const stripHyphens = (s: string): string =>
  deAccent(s)
    .replace(/\s[—–]\s/g, ", ")
    .replace(/[—–]/g, " ")
    .replace(/-/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()

export default async function fixNewProductCopy({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = container.resolve(Modules.PRODUCT)
  const apply = process.argv.includes("apply")

  logger.info(apply ? "APPLY mode — writing changes." : "DRY-RUN — no writes. Pass `apply` to commit.")

  let changed = 0
  for (const handle of HANDLES) {
    const [p] = await productService.listProducts({ handle })
    if (!p) {
      logger.warn(`  not found: ${handle}`)
      continue
    }
    const next: Record<string, string> = {}
    const newTitle = deAccent(p.title || "")
    const newSubtitle = stripHyphens(p.subtitle || "")
    const newDesc = stripHyphens(p.description || "")
    if (newTitle !== p.title) next.title = newTitle
    if (newSubtitle !== (p.subtitle || "")) next.subtitle = newSubtitle
    if (newDesc !== (p.description || "")) next.description = newDesc

    if (!Object.keys(next).length) continue
    changed++
    logger.info(`\n${handle}`)
    if (next.title) logger.info(`  title:    ${p.title}  ->  ${next.title}`)
    if (next.subtitle) logger.info(`  subtitle: ${p.subtitle}  ->  ${next.subtitle}`)
    if (next.description) logger.info(`  desc:     ...${(p.description || "").slice(0, 90)}...\n         -> ...${next.description.slice(0, 90)}...`)

    if (apply) {
      await productService.updateProducts(p.id, next)
    }
  }
  logger.info(`\n${apply ? "Updated" : "Would update"} ${changed}/${HANDLES.length} products.`)
}
