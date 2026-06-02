import { NextRequest, NextResponse } from "next/server"

import { searchSuggestions } from "@lib/data/search"

/**
 * GET /api/search?q=<term>&country=<code>
 * Type-ahead endpoint for the storefront search autocomplete.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? ""
  const country =
    req.nextUrl.searchParams.get("country") ??
    process.env.NEXT_PUBLIC_DEFAULT_REGION ??
    "in"

  try {
    const data = await searchSuggestions(q, country)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({
      products: [],
      categories: [],
      collections: [],
      fallback: [],
    })
  }
}
