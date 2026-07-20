import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Verify a list of product handles are live and each variant has inventory.
const HANDLES = [
  "emerald-tone-swirl-floral-pendant-earring-set",
  "sparkling-initial-k-pendant-earring-set",
  "double-heart-circle-drop-pendant-earring-set",
  "pearl-sunburst-baroque-drop-pendant-earring-set",
  "pear-cut-cz-halo-pendant-earring-set",
  "triple-star-open-circle-pendant-earring-set",
  "emerald-cut-cz-halo-pendant-earring-set",
  "openwork-angelfish-pendant-earring-set",
  "star-eyed-smiley-face-pendant-earring-set",
  "interlocking-double-circle-cz-pendant-earring-set",
  "polished-apple-cz-leaf-pendant-earring-set",
  "rose-gold-oval-pink-cz-pendant-earring-set",
  "baguette-lotus-double-circle-pendant-earring-set",
  "green-cz-trillion-halo-pendant-earring-set",
  "marquise-floral-medallion-cz-pendant-earring-set",
  "butterfly-cz-silver-rakhi",
  "om-sacred-cz-silver-rakhi",
  "floral-pinwheel-cz-silver-rakhi",
  "peacock-evil-eye-silver-rakhi",
  "om-ganesha-enamel-silver-rakhi",
  "bhai-infinity-cz-silver-rakhi",
  "feather-wing-cz-silver-rakhi",
  "shree-sacred-cz-silver-rakhi",
  "om-lotus-mandala-cz-silver-rakhi",
  "trishul-damru-shiva-silver-rakhi",
  "rose-gold-om-lotus-cz-rakhi",
  "silver-peacock-green-stone-rakhi",
  "silver-krishna-peacock-feather-rakhi",
  "rose-gold-red-stone-square-rakhi",
  "rose-gold-sparkling-butterfly-rakhi",
  "silver-krishna-flute-feather-rakhi",
  "rose-gold-pinwheel-floral-rakhi",
  "rose-gold-enamel-peacock-rakhi",
  "gold-krishna-peacock-feather-rakhi",
  "silver-trishul-round-medallion-rakhi",
  "silver-swastik-star-medallion-rakhi",
]

export default async function verify({ container }: ExecArgs) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "handle",
      "status",
      "categories.name",
      "variants.id",
      "variants.sku",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.location_id",
    ],
    filters: { handle: HANDLES } as any,
  })

  const byHandle = new Map((products as any[]).map((p) => [p.handle, p]))
  let liveOk = 0
  let stockOk = 0
  const problems: string[] = []

  for (const h of HANDLES) {
    const p = byHandle.get(h)
    if (!p) {
      problems.push(`MISSING (not in DB): ${h}`)
      continue
    }
    const live = p.status === "published"
    if (live) liveOk++
    let qty = 0
    const locs = new Set<string>()
    for (const v of p.variants || []) {
      for (const ii of v.inventory_items || []) {
        for (const lvl of ii.inventory?.location_levels || []) {
          qty += lvl.stocked_quantity || 0
          if (lvl.location_id) locs.add(lvl.location_id)
        }
      }
    }
    const stocked = qty > 0
    if (stocked) stockOk++
    const flag = live && stocked ? "OK  " : "BAD "
    if (!live || !stocked) {
      problems.push(
        `${flag}${h} :: status=${p.status} qty=${qty} locations=${locs.size} cat=${p.categories?.[0]?.name || "—"}`
      )
    }
  }

  console.log("VERIFY_START")
  console.log(`checked: ${HANDLES.length}`)
  console.log(`published: ${liveOk}/${HANDLES.length}`)
  console.log(`with stock: ${stockOk}/${HANDLES.length}`)
  if (problems.length) {
    console.log("PROBLEMS:")
    for (const p of problems) console.log("  " + p)
  } else {
    console.log("ALL GOOD: every handle published and stocked at 1 location.")
  }
  console.log("VERIFY_END")
}
