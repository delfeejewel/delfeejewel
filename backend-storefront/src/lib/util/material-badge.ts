/**
 * Short trust-badge label for a product's material.
 *
 * The PDP badge used to be the hardcoded string "925 Sterling" on every
 * product. That is wrong for the 999 fine silver coins — and it would have sat
 * inches from the product photo's own "FINE SILVER 999" stamp, on an item where
 * purity IS the product.
 *
 * Materials in the catalogue are long and descriptive ("925 Sterling Silver
 * with white and green cubic zirconia and teal enamel (gold-tone plated)"), so
 * this pulls out just the purity claim, which is all the badge has room for.
 *
 * Returns null when no purity can be read, and the caller hides the badge.
 * Falling back to "925 Sterling" would recreate the original bug the first time
 * a non-silver product appears.
 */
export function materialBadge(material?: string | null): string | null {
  const value = (material || "").trim()
  if (!value || value.toUpperCase() === "N/A") return null

  // "999 fine silver" / "925 sterling silver", in either order of wording.
  const match = value.match(/\b(\d{3})\b[^.,;(]*?\b(fine|sterling)\s+silver\b/i)
  if (match) {
    const purity = match[1]
    const kind = match[2].toLowerCase() === "fine" ? "Fine Silver" : "Sterling"
    return `${purity} ${kind}`
  }

  // A purity number with no "silver" wording still tells the shopper something.
  const bare = value.match(/\b(925|999|916|750)\b/)
  if (bare) return bare[1]

  return null
}
