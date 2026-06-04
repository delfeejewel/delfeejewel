import { getLocaleHeader } from "@lib/util/get-locale-header"
import Medusa, { FetchArgs, FetchInput } from "@medusajs/js-sdk"

// Resolve the backend URL. On the SERVER (lib/data, server actions) we use the
// internal/private MEDUSA_BACKEND_URL (e.g. http://backend:9000) — fastest, no
// extra hop. In CLIENT bundles Next.js strips every non-NEXT_PUBLIC_ env var, so
// MEDUSA_BACKEND_URL is undefined there; we fall back to the PUBLIC
// NEXT_PUBLIC_MEDUSA_BACKEND_URL (e.g. https://api.delfee.in) the browser can
// actually reach. Without that fallback the client SDK hits localhost:9000.
const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: false,
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

const originalFetch = sdk.client.fetch.bind(sdk.client)

sdk.client.fetch = async <T>(
  input: FetchInput,
  init?: FetchArgs
): Promise<T> => {
  const headers = init?.headers ?? {}
  let localeHeader: Record<string, string | null> | undefined
  try {
    localeHeader = await getLocaleHeader()
    headers["x-medusa-locale"] ??= localeHeader["x-medusa-locale"]
  } catch {}

  const newHeaders = {
    ...localeHeader,
    ...headers,
  }
  init = {
    ...init,
    headers: newHeaders,
  }
  return originalFetch(input, init)
}
