export type SuggestProduct = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  price: string | null
}

export type SuggestLink = {
  label: string
  handle: string
}

export type SearchSuggestions = {
  products: SuggestProduct[]
  categories: SuggestLink[]
  collections: SuggestLink[]
  /** Fallback recommendations shown when a query returns no product matches. */
  fallback: SuggestProduct[]
}
