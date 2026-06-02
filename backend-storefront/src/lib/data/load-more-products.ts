"use server"

import { listProducts } from "./products"
import { HttpTypes } from "@medusajs/types"

export async function loadMoreProducts({
  page,
  categoryId,
  tagId,
  countryCode,
  limit = 12,
}: {
  page: number
  categoryId?: string
  tagId?: string
  countryCode: string
  limit?: number
}): Promise<{
  products: HttpTypes.StoreProduct[]
  hasMore: boolean
}> {
  const queryParams: Record<string, any> = { limit }

  if (categoryId) {
    queryParams.category_id = [categoryId]
  }

  if (tagId) {
    queryParams.tag_id = [tagId]
  }

  const { response } = await listProducts({
    pageParam: page,
    queryParams,
    countryCode,
  })

  const totalLoaded = page * limit
  const hasMore = totalLoaded < response.count

  return {
    products: response.products,
    hasMore,
  }
}
