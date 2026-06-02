"use server"

import { sdk } from "@lib/config"
import { getCacheOptions } from "./cookies"

export async function getTagByValue(value: string): Promise<string | null> {
  const next = {
    ...(await getCacheOptions("tags")),
  }

  try {
    const { product_tags } = await sdk.client.fetch<{
      product_tags: { id: string; value: string }[]
    }>("/store/product-tags", {
      query: { value, limit: 1 },
      next,
      cache: "force-cache",
    })

    return product_tags?.[0]?.id || null
  } catch {
    return null
  }
}
