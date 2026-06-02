import { NextRequest } from "next/server"

/**
 * Proxies the Medusa GST invoice PDF so it can be opened from the storefront.
 * The backend /store route needs the publishable API key header, which a
 * plain anchor link cannot send — this server route adds it.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const backendUrl =
    process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
  const key = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  try {
    const res = await fetch(`${backendUrl}/store/orders/${id}/invoice`, {
      headers: key ? { "x-publishable-api-key": key } : {},
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
