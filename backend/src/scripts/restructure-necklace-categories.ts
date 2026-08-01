import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Split the necklace/pendant catalogue into its intended categories.
 *
 *   - "Necklaces" is RENAMED to "Necklace Sets" (handle stays `necklaces`, so
 *     every existing /categories/necklaces link keeps working).
 *   - Three new top-level categories: "Necklace Chains", "Chains", "Chain Sets".
 *   - Every product in TARGETS is moved to the category it is listed under.
 *
 * Usage (DRY RUN by default — prints the full plan and writes nothing):
 *   npx medusa exec ./src/scripts/restructure-necklace-categories.ts
 *   npx medusa exec ./src/scripts/restructure-necklace-categories.ts apply
 *
 * Idempotent: re-running after an apply is a no-op.
 */

/** Display name -> handle. Handles for existing categories must not change. */
const CATEGORY_HANDLES: Record<string, string> = {
  Rings: "rings",
  Bracelets: "bracelets",
  "Necklace Chains": "necklace-chains",
  "Necklace Sets": "necklaces", // renamed in place, handle preserved
  Chains: "chains",
  Rakhis: "rakhis",
  "Chain Sets": "chain-sets",
  Pendants: "pendants",
  Anklets: "anklets",
  Earrings: "earrings",
  Mangalsutras: "mangalsutras",
}

/** Categories to create if absent: handle -> {name, description, rank}. */
const NEW_CATEGORIES: Record<
  string,
  { name: string; description: string; rank: number }
> = {
  "necklace-chains": {
    name: "Necklace Chains",
    description:
      "Sterling silver necklaces worn on their own — solitaires, station chains and bead strands.",
    rank: 12,
  },
  chains: {
    name: "Chains",
    description:
      "Classic 925 sterling silver chains — figaro, curb and cable links.",
    rank: 13,
  },
  "chain-sets": {
    name: "Chain Sets",
    description:
      "Matching chain and earring sets in 925 sterling silver.",
    rank: 14,
  },
}

/** The rename: handle -> new display name. */
const RENAMES: Record<string, string> = {
  necklaces: "Necklace Sets",
}

/** product handle -> category display name (key of CATEGORY_HANDLES). */
const TARGETS: Record<string, string> = {
  "kite-solitaire-ring": "Rings",
  "petite-pave-dot-ring": "Rings",
  "twin-kite-ring": "Rings",
  "clover-cluster-ring": "Rings",
  "bezel-dot-solitaire-ring": "Rings",
  "pave-bow-ring": "Rings",
  "twin-hearts-ring": "Rings",
  "baguette-trilogy-ring": "Rings",
  "amethyst-leaf-ring": "Rings",
  "swirl-halo-ring": "Rings",
  "classic-halo-ring-adjustable": "Rings",
  "infinity-twist-solitaire-ring-adjustable": "Rings",
  "six-prong-solitaire-ring": "Rings",
  "petite-solitaire-ring": "Rings",
  "cushion-halo-ring-adjustable": "Rings",
  "art-deco-link-ring": "Rings",
  "octagon-filigree-ring": "Rings",
  "lucky-clover-ring": "Rings",
  "pave-bar-ring": "Rings",
  "rose-window-ring": "Rings",
  "double-halo-ring-adjustable": "Rings",
  "emerald-floral-halo-ring": "Rings",
  "amethyst-baguette-halo-ring-adjustable": "Rings",
  "ruby-pear-ballerina-ring": "Rings",
  "mens-oval-pave-signet-ring": "Rings",
  "mens-onyx-star-signet-ring": "Rings",
  "sapphire-daisy-bypass-ring": "Rings",
  "cushion-three-stone-halo-ring": "Rings",
  "aiden-grooved-band-solitaire-ring": "Rings",
  "aqua-duo-toi-et-moi-wrap-ring": "Rings",
  "aria-split-shank-solitaire-ring": "Rings",
  "art-deco-sunburst-adjustable-ring": "Rings",
  "astra-star-cluster-ring": "Rings",
  "azure-oval-halo-ring": "Rings",
  "celeste-pear-double-halo-ring": "Rings",
  "champagne-blossom-halo-ring": "Rings",
  "crossover-kiss-ring": "Rings",
  "cushion-halo-statement-ring": "Rings",
  "duetto-toi-et-moi-open-ring": "Rings",
  "elowen-petite-halo-ring": "Rings",
  "emerald-petal-bypass-cocktail-ring": "Rings",
  "marguerite-floral-halo-ring": "Rings",
  "milano-pave-bar-ring": "Rings",
  "pave-grid-signet-band": "Rings",
  "princess-halo-gents-ring": "Rings",
  "princess-solitaire-gents-band": "Rings",
  "radiant-three-stone-halo-ring": "Rings",
  "regal-oval-solitaire-signet-ring": "Rings",
  "round-solitaire-gents-ring": "Rings",
  "round-solitaire-ribbed-band": "Rings",
  "seraphina-round-halo-ring": "Rings",
  "twin-tile-pave-bypass-ring": "Rings",
  "verdana-leaf-vine-emerald-ring": "Rings",
  "verona-pear-bypass-ring": "Rings",
  "vintage-rosette-filigree-ring": "Rings",
  "woven-pave-signet-ring": "Rings",
  "regal-ladder-pave-signet-ring": "Rings",
  "monarch-solitaire-grooved-gents-band": "Rings",
  "meridian-solitaire-fluted-gents-band": "Rings",
  "bridge-pave-plaque-gents-band": "Rings",
  "gridiron-solitaire-checkerboard-gents-band": "Rings",
  "sovereign-solitaire-mens-band": "Rings",
  "regent-pave-plaque-signet-band": "Rings",
  "atlas-brushed-mens-solitaire-band": "Rings",
  "leo-crest-oxidised-mens-signet": "Rings",
  "emperor-pave-shoulder-mens-band": "Rings",
  "kingston-solitaire-gents-band": "Rings",
  "axel-grooved-solitaire-mens-band": "Rings",
  "titan-pave-tile-signet-band": "Rings",
  "maverick-oval-pave-signet-band": "Rings",
  "rex-solitaire-pave-signet-band": "Rings",
  "luminous-cushion-halo-ring": "Rings",
  "rose-whisper-heart-open-ring": "Rings",
  "grand-pave-solitaire-wide-band-ring": "Rings",
  "beloved-heart-halo-slim-ring": "Rings",
  "triple-ribbon-sparkle-split-shank-ring": "Rings",
  "azure-bloom-bypass-ring": "Rings",
  "oval-vow-split-shank-ring": "Rings",
  "coronet-baguette-solitaire-ring": "Rings",
  "shell-clover-wrap-ring": "Rings",
  "triple-arc-pave-solitaire-ring": "Rings",
  "tapered-wing-solitaire-ring": "Rings",
  "luminous-round-halo-ring": "Rings",
  "deco-baguette-halo-ring": "Rings",
  "pear-drop-bypass-ring": "Rings",

  "halo-oval-station-bracelet": "Bracelets",
  "emerald-cut-multi-stone-bracelet": "Bracelets",
  "oval-gemstone-halo-bracelet": "Bracelets",
  "baguette-line-bracelet": "Bracelets",
  "pave-heart-tennis-bracelet": "Bracelets",
  "hexagon-pave-bracelet": "Bracelets",
  "clover-onyx-pearl-bracelet": "Bracelets",
  "pave-link-station-bracelet": "Bracelets",
  "oval-cluster-bead-bracelet": "Bracelets",
  "pave-butterfly-clover-bracelet": "Bracelets",
  "bezel-dot-bead-bracelet": "Bracelets",
  "round-baguette-tennis-bracelet": "Bracelets",
  "classic-tennis-bracelet": "Bracelets",
  "mariner-link-heart-bracelet": "Bracelets",
  "evil-eye-bead-bracelet": "Bracelets",
  "pave-nail-bracelet": "Bracelets",
  "sunburst-medallion-bracelet": "Bracelets",
  "monogram-charm-bracelet": "Bracelets",
  "black-bead-mangalsutra-bracelet": "Bracelets",
  "oval-pave-station-bracelet": "Bracelets",
  "multi-colour-eye-disc-bracelet": "Bracelets",
  "pave-star-station-bracelet": "Bracelets",
  "round-cz-tennis-bracelet": "Bracelets",
  "evil-eye-disc-station-bracelet": "Bracelets",
  "emerald-link-tennis-bracelet": "Bracelets",
  "baguette-move-tennis-bracelet": "Bracelets",
  "garden-charm-bangle": "Bracelets",
  "turquoise-coral-cuff": "Bracelets",
  "mother-of-pearl-eye-bangle": "Bracelets",
  "ruby-emerald-temple-kada": "Bracelets",
  "mens-curb-chain-bracelet": "Bracelets",
  "pave-cz-hexagon-link-bracelet": "Bracelets",
  "rose-bloom-oxidised-pearl-bracelet": "Bracelets",
  "two-tone-monogram-link-bracelet": "Bracelets",
  "sapphire-drop-twin-strand-pearl-bracelet": "Bracelets",
  "aventurine-pearl-medallion-oxidised-bracelet": "Bracelets",
  "honeycomb-hexagon-adjustable-silver-bracelet": "Bracelets",
  "pave-oval-link-adjustable-silver-bracelet": "Bracelets",
  "heart-charm-mesh-slider-silver-bracelet": "Bracelets",
  "panther-head-pave-link-silver-bracelet": "Bracelets",
  "kite-station-silver-tennis-bracelet": "Bracelets",
  "amethyst-glow-turquoise-bar-bracelet": "Bracelets",
  "sapphire-fan-twin-strand-pearl-bracelet": "Bracelets",
  "ruby-petal-twin-strand-pearl-bracelet": "Bracelets",
  "azure-evil-eye-cord-bracelet": "Bracelets",
  "moonmist-grey-pearl-twig-bangle": "Bracelets",
  "playful-squirrel-charm-bracelet": "Bracelets",
  "emerald-evil-eye-cord-bracelet": "Bracelets",
  "midnight-halo-bolo-bracelet": "Bracelets",
  "london-blue-teardrop-box-chain-bracelet": "Bracelets",
  "ruby-five-stone-adjustable-bolo-bracelet": "Bracelets",
  "oxidised-leaf-solitaire-cz-foxtail-bracelet": "Bracelets",
  "lapis-blue-bead-snake-chain-bracelet": "Bracelets",
  "emerald-green-crown-ball-chain-bracelet": "Bracelets",
  "emerald-halo-white-bead-silver-bracelet": "Bracelets",
  "emerald-teardrop-cabochon-silver-bracelet": "Bracelets",
  "vintage-open-heart-oxidised-link-bracelet": "Bracelets",
  "ruby-oval-bolo-slider-bracelet": "Bracelets",
  "amethyst-bezel-station-fine-chain-bracelet": "Bracelets",
  "pink-rosette-bolo-slider-bracelet": "Bracelets",
  "blue-cubic-zirconia-bolo-bracelet": "Bracelets",
  "purple-emerald-cut-solitaire-chain-bracelet": "Bracelets",
  "lavender-cubic-zirconia-station-bracelet": "Bracelets",
  "golden-carved-swirl-station-bracelet": "Bracelets",
  "purple-cushion-cubic-zirconia-line-bracelet": "Bracelets",
  "sky-blue-teardrop-link-bracelet": "Bracelets",
  "rainbow-round-chakra-link-bracelet": "Bracelets",
  "purple-teardrop-amethyst-hue-bracelet": "Bracelets",
  "oxidised-marcasite-slider-bracelet": "Bracelets",
  "rainbow-square-cut-multicolour-bracelet": "Bracelets",
  "blue-elephant-baby-kada-pair": "Bracelets",
  "little-planet-baby-kada-pair": "Bracelets",
  "plain-polished-baby-kada-pair": "Bracelets",
  "bunny-ears-baby-kada-pair": "Bracelets",
  "angel-wing-baby-kada-pair": "Bracelets",

  "peridot-crystal-bead-necklace": "Necklace Chains",
  "rose-flower-crystal-necklace": "Necklace Chains",
  "crystal-butterfly-cluster-necklace": "Necklace Chains",
  "ruby-crystal-bead-necklace": "Necklace Chains",
  "amethyst-marquise-charm-necklace": "Necklace Chains",
  "open-square-station-necklace": "Necklace Chains",
  "star-disc-station-necklace": "Necklace Chains",
  "amethyst-marquise-drop-necklace": "Necklace Chains",
  "classic-round-cz-tennis-necklace": "Necklace Chains",
  "classic-six-prong-solitaire-necklace": "Necklace Chains",
  "open-circle-halo-solitaire-necklace": "Necklace Chains",

  "chand-temple-necklace-earring-set": "Necklace Sets",
  "floral-cluster-cz-necklace-earring-set": "Necklace Sets",
  "pearl-emerald-drop-necklace-earring-set": "Necklace Sets",
  "pink-petal-bridal-necklace-earring-set": "Necklace Sets",
  "multi-gemstone-bead-necklace": "Necklace Sets",
  "blossom-vine-necklace-earring-set": "Necklace Sets",
  "blue-solitaire-feather-necklace-earring-set": "Necklace Sets",
  "emerald-cut-cz-leaf-vine-necklace-earring-set": "Necklace Sets",
  "heartfelt-sparkle-necklace-earring-set": "Necklace Sets",
  "ivy-leaf-marquise-necklace-earring-set": "Necklace Sets",
  "mother-of-pearl-evil-eye-heart-necklace-earring-set": "Necklace Sets",
  "oval-crystal-halo-drop-leaf-necklace-earring-set": "Necklace Sets",
  "oxidised-temple-green-bead-pearl-necklace-earring-set": "Necklace Sets",
  "pave-fan-drop-collar-necklace-earring-set": "Necklace Sets",
  "pearl-strand-floral-jhumka-drop-necklace-earring-set": "Necklace Sets",
  "purple-amethyst-asymmetric-collar-necklace-earring-set": "Necklace Sets",
  "rose-gold-lotus-floral-pendant-necklace-earring-set": "Necklace Sets",
  "ruby-red-emerald-green-drop-necklace-earring-set": "Necklace Sets",
  "rose-gold-tone-teardrop-cascade-pendant-earring-set": "Necklace Sets",
  "teal-enamel-chevron-kundan-style-pendant-earring-set": "Necklace Sets",
  "faux-pearl-strand-ruby-tone-petal-pendant-earring-set": "Necklace Sets",
  "crimson-sunburst-halo-tennis-pendant-earring-set": "Necklace Sets",
  "art-deco-filigree-sparkle-necklace-earring-set": "Necklace Sets",
  "emerald-green-round-solitaire-riviera-necklace-earring-set": "Necklace Sets",

  "tube-bead-station-cable-chain-necklace": "Chains",
  "sterling-silver-figaro-link-chain-necklace": "Chains",
  "sterling-silver-cuban-curb-chain-necklace": "Chains",

  "butterfly-cz-silver-rakhi": "Rakhis",
  "om-sacred-cz-silver-rakhi": "Rakhis",
  "floral-pinwheel-cz-silver-rakhi": "Rakhis",
  "peacock-evil-eye-silver-rakhi": "Rakhis",
  "om-ganesha-enamel-silver-rakhi": "Rakhis",
  "bhai-infinity-cz-silver-rakhi": "Rakhis",
  "feather-wing-cz-silver-rakhi": "Rakhis",
  "shree-sacred-cz-silver-rakhi": "Rakhis",
  "om-lotus-mandala-cz-silver-rakhi": "Rakhis",
  "trishul-damru-shiva-silver-rakhi": "Rakhis",
  "rose-gold-om-lotus-cz-rakhi": "Rakhis",
  "silver-peacock-green-stone-rakhi": "Rakhis",
  "silver-krishna-peacock-feather-rakhi": "Rakhis",
  "rose-gold-red-stone-square-rakhi": "Rakhis",
  "rose-gold-sparkling-butterfly-rakhi": "Rakhis",
  "silver-krishna-flute-feather-rakhi": "Rakhis",
  "rose-gold-pinwheel-floral-rakhi": "Rakhis",
  "rose-gold-enamel-peacock-rakhi": "Rakhis",
  "gold-krishna-peacock-feather-rakhi": "Rakhis",
  "silver-trishul-round-medallion-rakhi": "Rakhis",
  "silver-swastik-star-medallion-rakhi": "Rakhis",

  "calla-leaf-pave-necklace-earring-set": "Chain Sets",
  "emerald-bloom-halo-necklace-earring-set": "Chain Sets",
  "emerald-mosaic-cushion-necklace-earring-set": "Chain Sets",
  "emerald-green-cluster-necklace-earring-set": "Chain Sets",
  "green-onyx-hammered-disc-necklace-earring-set": "Chain Sets",
  "onyx-noir-princess-cut-necklace-earring-set": "Chain Sets",
  "petal-drop-solitaire-necklace-earring-set": "Chain Sets",
  "trillion-radiance-halo-necklace-earring-set": "Chain Sets",
  "polki-style-teardrop-scallop-pendant-necklace-earring-set": "Chain Sets",
  "regal-kundan-style-leaf-ruby-red-drop-necklace-earring-set": "Chain Sets",
  "winged-heart-mother-of-pearl-necklace-earring-ring-set": "Chain Sets",
  "midnight-black-marquise-vine-drop-necklace-earring-set": "Chain Sets",
  "pave-disc-halo-necklace-earring-set": "Chain Sets",
  "ruby-petal-wheel-necklace-earring-set": "Chain Sets",
  "marquise-double-halo-necklace-earring-set": "Chain Sets",
  "pink-baguette-medallion-necklace-earring-set": "Chain Sets",
  "royal-blue-vintage-halo-necklace-earring-set": "Chain Sets",
  "ruby-red-oval-halo-drop-necklace-earring-set": "Chain Sets",
  "sapphire-trinity-baguette-necklace-earring-set": "Chain Sets",
  "teardrop-halo-floating-solitaire-necklace-earring-set": "Chain Sets",
  "pave-heart-sparkle-necklace-earring-set": "Chain Sets",
  "pink-lattice-oval-necklace-earring-set": "Chain Sets",
  "pink-blossom-circle-necklace-earring-set": "Chain Sets",
  "emerald-sunburst-teardrop-necklace-earring-set": "Chain Sets",
  "pink-baguette-hexagon-necklace-earring-set": "Chain Sets",
  "emerald-petal-bloom-necklace-earring-set": "Chain Sets",
  "emerald-whirl-medallion-necklace-earring-set": "Chain Sets",
  "emerald-chakra-wheel-necklace-earring-set": "Chain Sets",
  "emerald-tone-swirl-floral-pendant-earring-set": "Chain Sets",
  "sparkling-initial-k-pendant-earring-set": "Chain Sets",
  "pearl-sunburst-baroque-drop-pendant-earring-set": "Chain Sets",
  "baguette-lotus-double-circle-pendant-earring-set": "Chain Sets",
  "green-cz-trillion-halo-pendant-earring-set": "Chain Sets",
  "gold-tone-kundan-style-blossom-disc-pendant-earring-set": "Chain Sets",

  "hexagon-solitaire-necklace-earring-set": "Pendants",
  "crimson-lace-teardrop-necklace-earring-set": "Pendants",
  "mauve-pearl-hammered-disc-necklace-earring-set": "Pendants",
  "starlit-circle-necklace-earring-set": "Pendants",
  "double-heart-circle-drop-pendant-earring-set": "Pendants",
  "pear-cut-cz-halo-pendant-earring-set": "Pendants",
  "triple-star-open-circle-pendant-earring-set": "Pendants",
  "emerald-cut-cz-halo-pendant-earring-set": "Pendants",
  "openwork-angelfish-pendant-earring-set": "Pendants",
  "star-eyed-smiley-face-pendant-earring-set": "Pendants",
  "interlocking-double-circle-cz-pendant-earring-set": "Pendants",
  "polished-apple-cz-leaf-pendant-earring-set": "Pendants",
  "marquise-floral-medallion-cz-pendant-earring-set": "Pendants",
  "mint-tone-cascade-oval-pendant-earring-set": "Pendants",
  "pave-lightning-bolt-pendant-earring-set": "Pendants",
  "domed-triangle-pave-pendant-earring-set": "Pendants",
  "playful-dolphin-pave-pendant-earring-set": "Pendants",

  "classic-rope-chain-anklets": "Anklets",
  "dainty-beaded-snake-chain-anklets": "Anklets",
  "floating-pearl-station-anklets": "Anklets",
  "floral-cz-double-chain-anklets-ghungroo": "Anklets",
  "infinity-love-cz-pave-anklets": "Anklets",
  "ruby-emerald-floral-cluster-statement-anklets": "Anklets",

  "emerald-star-chain-drop-earrings": "Earrings",
  "filigree-cone-pearl-green-bead-drops": "Earrings",
  "filigree-dome-pearl-garnet-drops": "Earrings",
  "navratna-teardrop-statement-studs": "Earrings",
  "pave-line-huggie-hoop-earrings": "Earrings",
  "polished-dome-chunky-hoop-earrings": "Earrings",
  "sapphire-fan-chandelier-earrings": "Earrings",
  "star-stud-hexagon-long-chain-drops": "Earrings",
  "kundan-ruby-drop-earrings": "Earrings",
  "blossom-starburst-stud-earrings": "Earrings",
  "hexagon-ruby-blossom-stud-earrings": "Earrings",
  "enamel-rose-coin-stud-earrings": "Earrings",
  "emerald-halo-circle-stud-earrings": "Earrings",
  "teardrop-halo-stud-earrings": "Earrings",
  "ruby-bloom-floral-stud-earrings": "Earrings",
  "emerald-petal-pearl-drop-earrings": "Earrings",
  "emerald-cameo-floral-halo-stud-earrings": "Earrings",
  "ruby-and-crystal-mosaic-drop-earrings": "Earrings",
  "emerald-paisley-carved-drop-earrings": "Earrings",
  "emerald-petal-floral-stud-earrings": "Earrings",
  "ruby-fan-kundan-dangle-earrings": "Earrings",
  "crystal-oval-linear-drop-earrings": "Earrings",
  "pearl-and-green-cabochon-halo-drop-earrings": "Earrings",
  "open-sketch-heart-cz-ball-drop-earrings": "Earrings",
  "half-moon-pave-button-studs": "Earrings",
  "pyramid-pave-triangle-studs": "Earrings",
  "fluted-oval-cz-halo-studs": "Earrings",
  "filigree-bloom-oval-cz-studs": "Earrings",
  "pink-petal-emerald-cut-drop-earrings": "Earrings",
  "sapphire-emerald-cut-pear-drop-earrings": "Earrings",
  "baroque-pearl-bead-hook-earrings": "Earrings",
  "vintage-foliate-green-teardrop-earrings": "Earrings",
  "split-disc-pave-circle-stud-earrings": "Earrings",
  "pyramid-pave-triangle-stud-earrings": "Earrings",
  "marquise-red-halo-drop-earrings": "Earrings",
  "oval-brilliant-cut-halo-stud-earrings": "Earrings",
  "vintage-floral-oval-halo-stud-earrings": "Earrings",
  "pink-rose-emerald-cut-drop-earrings": "Earrings",
  "blue-sapphire-hue-teardrop-drop-earrings": "Earrings",
  "baroque-pearl-silver-drop-earrings": "Earrings",
  "open-heart-sparkle-drop-earrings": "Earrings",
  "green-marcasite-leaf-drop-earrings": "Earrings",
  "blue-butterfly-filigree-jhumka-earrings": "Earrings",
  "baguette-cascade-chandelier-earrings": "Earrings",
  "oxidised-clover-black-bead-jhumka-earrings": "Earrings",
  "navratna-petal-faux-pearl-drop-earrings": "Earrings",
  "twin-green-cabochon-pearl-cluster-drops": "Earrings",

  "infinity-floral-cz-single-line-mangalsutra": "Mangalsutras",
  "princess-cut-halo-single-line-mangalsutra": "Mangalsutras",
  "triple-oval-halo-single-line-mangalsutra": "Mangalsutras",
  "twin-oval-halo-single-line-mangalsutra": "Mangalsutras",
}

export default async function run({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const apply = args.includes("apply")
  const banner = apply ? "APPLYING" : "DRY RUN (pass `apply` to write)"

  const loadCategories = async () => {
    const { data } = await query.graph({
      entity: "product_category",
      fields: ["id", "name", "handle", "rank"],
    })
    return new Map<string, any>((data as any[]).map((c) => [c.handle, c]))
  }

  let catsByHandle = await loadCategories()

  // ---- 1. rename -------------------------------------------------------
  logger.info(`--- ${banner} ---`)
  logger.info("1. Renames:")
  const renameInput: any[] = []
  for (const [handle, name] of Object.entries(RENAMES)) {
    const cat = catsByHandle.get(handle)
    if (!cat) {
      logger.warn(`   ! no category with handle "${handle}" — skipped`)
      continue
    }
    if (cat.name === name) {
      logger.info(`   = "${handle}" is already named "${name}"`)
      continue
    }
    logger.info(`   ~ "${cat.name}" -> "${name}" (handle "${handle}" unchanged)`)
    renameInput.push({ id: cat.id, name })
  }
  if (apply && renameInput.length) {
    // updateProductCategoriesWorkflow takes one selector+update pair, so run
    // one call per category rather than a batch.
    for (const r of renameInput) {
      await updateProductCategoriesWorkflow(container).run({
        input: { selector: { id: r.id }, update: { name: r.name } },
      })
    }
  }

  // ---- 2. create missing categories ------------------------------------
  logger.info("2. New categories:")
  const toCreate = Object.entries(NEW_CATEGORIES).filter(
    ([handle]) => !catsByHandle.has(handle)
  )
  for (const [handle, def] of toCreate) {
    logger.info(`   + "${def.name}" (${handle}), rank ${def.rank}`)
  }
  for (const [handle] of Object.entries(NEW_CATEGORIES)) {
    if (catsByHandle.has(handle)) logger.info(`   = "${handle}" already exists`)
  }
  if (apply && toCreate.length) {
    await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: toCreate.map(([handle, def]) => ({
          name: def.name,
          handle,
          description: def.description,
          rank: def.rank,
          is_active: true,
          is_internal: false,
        })),
      },
    })
    catsByHandle = await loadCategories()
  }

  // ---- 3. move products -------------------------------------------------
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "categories.id", "categories.handle"],
    pagination: { take: 1000 },
  } as any)
  const productsByHandle = new Map<string, any>(
    (products as any[]).map((p) => [p.handle, p])
  )

  const moves: { id: string; from: string; to: string; handle: string }[] = []
  const unknownProducts: string[] = []
  const unknownCategories: string[] = []

  for (const [productHandle, categoryName] of Object.entries(TARGETS)) {
    const targetHandle = CATEGORY_HANDLES[categoryName]
    if (!targetHandle) {
      unknownCategories.push(`${productHandle} -> "${categoryName}"`)
      continue
    }
    const product = productsByHandle.get(productHandle)
    if (!product) {
      unknownProducts.push(productHandle)
      continue
    }
    const current = (product.categories || []).map((c: any) => c.handle)
    if (current.length === 1 && current[0] === targetHandle) continue

    // In a dry run the new categories do not exist yet, so resolve lazily.
    const targetId = catsByHandle.get(targetHandle)?.id ?? "(to be created)"
    moves.push({
      id: targetId,
      from: current.join(", ") || "none",
      to: targetHandle,
      handle: productHandle,
    })
  }

  logger.info(`3. Product moves (${moves.length}):`)
  const byTarget = new Map<string, string[]>()
  for (const m of moves) {
    if (!byTarget.has(m.to)) byTarget.set(m.to, [])
    byTarget.get(m.to)!.push(`${m.handle} (was: ${m.from})`)
  }
  for (const [to, list] of [...byTarget.entries()].sort()) {
    logger.info(`   -> ${to} (${list.length}):`)
    for (const l of list.sort()) logger.info(`        ${l}`)
  }
  if (!moves.length) logger.info("   (nothing to move)")

  if (apply && moves.length) {
    await updateProductsWorkflow(container).run({
      input: {
        products: moves.map((m) => {
          const id = productsByHandle.get(m.handle).id
          const categoryId = catsByHandle.get(m.to)!.id
          return { id, category_ids: [categoryId] }
        }),
      },
    })
    logger.info(`   applied ${moves.length} moves`)
  }

  // ---- 4. report anything outside the plan ------------------------------
  if (unknownProducts.length) {
    logger.warn(
      `Listed but not in the catalogue (${unknownProducts.length}): ${unknownProducts.join(", ")}`
    )
  }
  if (unknownCategories.length) {
    logger.warn(`Unknown target category: ${unknownCategories.join(", ")}`)
  }
  const unlisted = (products as any[])
    .filter((p) => !TARGETS[p.handle])
    .map((p) => `${p.handle} [${(p.categories || []).map((c: any) => c.handle).join(",") || "none"}]`)
  if (unlisted.length) {
    logger.warn(
      `In the catalogue but not in the list — left untouched (${unlisted.length}):`
    )
    for (const u of unlisted.sort()) logger.warn(`   ${u}`)
  }

  logger.info(apply ? "Done." : "Dry run complete — nothing was written.")
}
