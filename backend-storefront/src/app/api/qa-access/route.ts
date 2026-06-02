import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/qa-access
 * Body: { token: string }
 *
 * Validates a QA/team access token against COMING_SOON_QA_TOKEN. On a match,
 * sets the same `qa_bypass=1` cookie the middleware trusts, so the browser can
 * preview the real site while the world still sees the coming-soon page.
 *
 * This is the friendly counterpart to the `?qa=<token>` URL bypass — same
 * cookie, same security, but entered once via a form instead of the URL.
 */
export async function POST(req: NextRequest) {
  const qaToken = process.env.COMING_SOON_QA_TOKEN

  // If no token is configured, the bypass is effectively disabled.
  if (!qaToken) {
    return NextResponse.json(
      { ok: false, message: "Access is not available right now." },
      { status: 503 }
    )
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 })
  }

  const token = String(payload?.token || "").trim()
  if (!token || token !== qaToken) {
    return NextResponse.json(
      { ok: false, message: "That access code isn't right. Check it and try again." },
      { status: 401 }
    )
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set("qa_bypass", "1", {
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
  return res
}
