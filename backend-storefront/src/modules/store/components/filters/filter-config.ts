export type FilterOption = {
  label: string
  value: string
}

export type FilterGroup = {
  key: string
  label: string
  type: "checkbox" | "range" | "rating" | "grid"
  section: "core" | "expandable"
  options?: FilterOption[]
  min?: number
  max?: number
  step?: number
  prefix?: string
  presets?: { label: string; min: number; max: number }[]
}

// ─── Common filters (all categories) ─────────────────
export const COMMON_FILTERS: FilterGroup[] = [
  {
    key: "price",
    label: "Price Range",
    type: "range",
    section: "core",
    min: 500,
    max: 50000,
    step: 500,
    prefix: "₹",
    presets: [
      { label: "Under ₹1,000", min: 500, max: 1000 },
      { label: "₹1,000 – ₹3,000", min: 1000, max: 3000 },
      { label: "₹3,000 – ₹5,000", min: 3000, max: 5000 },
      { label: "₹5,000 – ₹10,000", min: 5000, max: 10000 },
      { label: "₹10,000 – ₹25,000", min: 10000, max: 25000 },
      { label: "₹25,000+", min: 25000, max: 50000 },
    ],
  },
  {
    key: "metal",
    label: "Metal & Purity",
    type: "checkbox",
    section: "core",
    options: [
      { label: "Sterling Silver 925", value: "sterling-silver-925" },
      { label: "Pure Silver (999)", value: "pure-silver-999" },
      { label: "Silver Plated", value: "silver-plated" },
      { label: "Oxidized Silver", value: "oxidized-silver" },
    ],
  },
  {
    key: "occasion",
    label: "Occasion",
    type: "checkbox",
    section: "core",
    options: [
      { label: "Daily Wear", value: "daily-wear" },
      { label: "Office Wear", value: "office-wear" },
      { label: "Party Wear", value: "party-wear" },
      { label: "Bridal / Wedding", value: "bridal-wedding" },
      { label: "Festive", value: "festive" },
    ],
  },
  {
    key: "style",
    label: "Style / Design",
    type: "checkbox",
    section: "core",
    options: [
      { label: "Minimal", value: "minimal" },
      { label: "Traditional", value: "traditional" },
      { label: "Modern", value: "modern" },
      { label: "Boho", value: "boho" },
      { label: "Floral", value: "floral" },
      { label: "Geometric", value: "geometric" },
    ],
  },
  {
    key: "gender",
    label: "Gender",
    type: "checkbox",
    section: "core",
    options: [
      { label: "Women", value: "women" },
      { label: "Men", value: "men" },
      { label: "Unisex", value: "unisex" },
      { label: "Kids", value: "kids" },
    ],
  },
  {
    key: "stone_type",
    label: "Stone Type",
    type: "checkbox",
    section: "expandable",
    options: [
      { label: "No Stone", value: "no-stone" },
      { label: "Cubic Zirconia", value: "cubic-zirconia" },
      { label: "American Diamond", value: "american-diamond" },
      { label: "Gemstones", value: "gemstones" },
      { label: "Pearl", value: "pearl" },
    ],
  },
  {
    key: "stone_color",
    label: "Stone Color",
    type: "checkbox",
    section: "expandable",
    options: [
      { label: "White / Transparent", value: "white" },
      { label: "Red", value: "red" },
      { label: "Green", value: "green" },
      { label: "Blue", value: "blue" },
      { label: "Multicolor", value: "multicolor" },
    ],
  },
  {
    key: "finish",
    label: "Finish / Plating",
    type: "checkbox",
    section: "expandable",
    options: [
      { label: "Polished", value: "polished" },
      { label: "Matte", value: "matte" },
      { label: "Oxidized", value: "oxidized" },
      { label: "Rhodium-plated", value: "rhodium-plated" },
      { label: "Antique Finish", value: "antique-finish" },
    ],
  },
  {
    key: "rating",
    label: "Rating",
    type: "rating",
    section: "expandable",
  },
  {
    key: "collection",
    label: "Collection / Tags",
    type: "checkbox",
    section: "expandable",
    options: [
      { label: "Best Seller", value: "best-seller" },
      { label: "New Arrivals", value: "new-arrivals" },
      { label: "Trending", value: "trending" },
      { label: "Limited Edition", value: "limited-edition" },
    ],
  },
  {
    key: "availability",
    label: "Availability",
    type: "checkbox",
    section: "expandable",
    options: [
      { label: "In Stock", value: "in-stock" },
      { label: "Ready to Ship", value: "ready-to-ship" },
      { label: "Fast Delivery", value: "fast-delivery" },
    ],
  },
  {
    key: "care",
    label: "Care & Durability",
    type: "checkbox",
    section: "expandable",
    options: [
      { label: "Anti-tarnish", value: "anti-tarnish" },
      { label: "Waterproof", value: "waterproof" },
      { label: "Hypoallergenic", value: "hypoallergenic" },
    ],
  },
  {
    key: "weight",
    label: "Weight",
    type: "checkbox",
    section: "expandable",
    options: [
      { label: "Light (under 5g)", value: "light" },
      { label: "Medium (5–15g)", value: "medium" },
      { label: "Heavy (15g+)", value: "heavy" },
    ],
  },
]

// ─── Category-specific filters ───────────────────────
export const CATEGORY_FILTERS: Record<string, FilterGroup[]> = {
  rings: [
    {
      key: "ring_size",
      label: "Ring Size",
      type: "grid",
      section: "core",
      options: Array.from({ length: 15 }, (_, i) => ({
        label: `${i + 4}`,
        value: `${i + 4}`,
      })),
    },
    {
      key: "ring_type",
      label: "Ring Type",
      type: "checkbox",
      section: "core",
      options: [
        { label: "Band", value: "band" },
        { label: "Solitaire", value: "solitaire" },
        { label: "Cocktail", value: "cocktail" },
        { label: "Stackable", value: "stackable" },
        { label: "Adjustable", value: "adjustable" },
      ],
    },
  ],
  earrings: [
    {
      key: "earring_type",
      label: "Earring Type",
      type: "checkbox",
      section: "core",
      options: [
        { label: "Studs", value: "studs" },
        { label: "Jhumkas", value: "jhumkas" },
        { label: "Hoops", value: "hoops" },
        { label: "Drop / Dangle", value: "drop-dangle" },
        { label: "Ear Cuffs", value: "ear-cuffs" },
        { label: "Chandbali", value: "chandbali" },
      ],
    },
    {
      key: "closure",
      label: "Closure Type",
      type: "checkbox",
      section: "core",
      options: [
        { label: "Push Back", value: "push-back" },
        { label: "Screw Back", value: "screw-back" },
        { label: "Lever Back", value: "lever-back" },
        { label: "Hook", value: "hook" },
      ],
    },
  ],
  necklaces: [
    {
      key: "necklace_type",
      label: "Necklace Type",
      type: "checkbox",
      section: "core",
      options: [
        { label: "Chain", value: "chain" },
        { label: "Pendant", value: "pendant" },
        { label: "Choker", value: "choker" },
        { label: "Mangalsutra", value: "mangalsutra" },
        { label: "Layered", value: "layered" },
        { label: "Statement", value: "statement" },
      ],
    },
    {
      key: "chain_length",
      label: "Chain Length",
      type: "checkbox",
      section: "core",
      options: [
        { label: "14 inch", value: "14" },
        { label: "16 inch", value: "16" },
        { label: "18 inch", value: "18" },
        { label: "20 inch", value: "20" },
        { label: "22 inch", value: "22" },
        { label: "24 inch", value: "24" },
      ],
    },
  ],
  bracelets: [
    {
      key: "bracelet_type",
      label: "Bracelet Type",
      type: "checkbox",
      section: "core",
      options: [
        { label: "Chain Bracelet", value: "chain" },
        { label: "Bangle", value: "bangle" },
        { label: "Kada", value: "kada" },
        { label: "Cuff", value: "cuff" },
        { label: "Charm", value: "charm" },
        { label: "Tennis", value: "tennis" },
      ],
    },
    {
      key: "bracelet_size",
      label: "Bracelet Size",
      type: "checkbox",
      section: "core",
      options: [
        { label: "6 inch", value: "6" },
        { label: "6.5 inch", value: "6.5" },
        { label: "7 inch", value: "7" },
        { label: "7.5 inch", value: "7.5" },
        { label: "8 inch", value: "8" },
        { label: "Adjustable", value: "adjustable" },
      ],
    },
  ],
}
