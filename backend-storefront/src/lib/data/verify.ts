"use server"

import { sdk } from "@lib/config"

export type VerificationResult = {
  verified: boolean
  code?: string
  product?: {
    id: string
    title: string
    handle: string
    description: string | null
    thumbnail: string | null
    material: string | null
    metadata: Record<string, any>
  }
  variant?: {
    id: string
    title: string
    sku: string | null
  }
  message?: string
}

export const verifyQrCode = async (
  code: string
): Promise<VerificationResult> => {
  if (!code?.trim()) {
    return { verified: false, message: "Code is required." }
  }
  try {
    return await sdk.client.fetch<VerificationResult>(
      `/store/qr-verify/${encodeURIComponent(code.trim())}`,
      { method: "GET" }
    )
  } catch (e: any) {
    return {
      verified: false,
      message: e?.message?.includes("404")
        ? "This code isn't recognized."
        : e?.message || "Could not verify this code.",
    }
  }
}
