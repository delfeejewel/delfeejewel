import { NextRequest } from "next/server"

/**
 * Proxies the Medusa GST invoice PDF so it can be opened from the storefront.
 * The backend /store route needs the publishable API key header, which a
 * plain anchor link cannot send — this server route adds it.
 *
 * The backend invoice route is ownership-checked (it exposes order PII), so we
 * also forward the caller's identity: the customer JWT (`_medusa_jwt`) for
 * logged-in users, or the per-order guest token (`_order_token_<id>`). Without
 * one of these the backend returns 401.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const backendUrl =
    process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const key = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  const jwt = req.cookies.get("_medusa_jwt")?.value
  const orderToken = req.cookies.get(`_order_token_${id}`)?.value

  const headers: Record<string, string> = {}
  if (key) headers["x-publishable-api-key"] = key
  if (jwt) headers["authorization"] = `Bearer ${jwt}`
  if (orderToken) headers["x-order-token"] = orderToken

  try {
    const res = await fetch(`${backendUrl}/store/orders/${id}/invoice`, {
      headers,
      cache: "no-store",
    })

    if (!res.ok) {
      return new Response("Unable to generate invoice for this order.", {
        status: res.status,
      })
    }

    const pdf = await res.arrayBuffer()
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${id}.pdf"`,
      },
    })
  } catch {
    return new Response("Invoice service is unavailable.", { status: 502 })
  }
}
