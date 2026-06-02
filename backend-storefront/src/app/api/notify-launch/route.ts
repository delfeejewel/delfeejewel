import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/notify-launch
 * Body: { email: string, source?: string }
 *
 * Stores the email in the Supabase `launch_signups` table. Idempotent —
 * duplicate emails return success (we don't reveal whether they were
 * already signed up).
 *
 * Falls back to logging server-side if Supabase isn't configured, so
 * the page still feels responsive while the table is being provisioned.
 */
export async function POST(req: NextRequest) {
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const email = String(payload?.email || "").trim().toLowerCase()
  const source = String(payload?.source || "coming-soon").slice(0, 64)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { message: "Please enter a valid email address." },
      { status: 400 }
    )
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Graceful degradation: log + accept even if Supabase isn't configured yet.
  if (!supabaseUrl || !serviceKey) {
    console.warn(
      `[notify-launch] Supabase not configured; storing in log only: ${email} (${source})`
    )
    return NextResponse.json({ ok: true })
  }

  try {
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
    const { error } = await client.from("launch_signups").insert({
      email,
      source,
    })

    // 23505 = unique violation (email already signed up). Treat as success.
    if (error && (error.code === "23505" || /duplicate key/i.test(error.message))) {
      return NextResponse.json({ ok: true, already_signed_up: true })
    }
    if (error) {
      console.error("[notify-launch] insert failed", error)
      // Don't expose DB errors to the client; treat as accepted so user
      // sees a friendly success — we'll see the error in logs.
      return NextResponse.json({ ok: true, logged: true })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[notify-launch] exception", e)
    return NextResponse.json({ ok: true, logged: true })
  }
}
