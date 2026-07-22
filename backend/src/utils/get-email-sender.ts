import { createClient } from "@supabase/supabase-js"
import { Pool } from "pg"
import { TransportConfig } from "../modules/email_notification/transport"

// The outbound email sender is configured in the CMS (cms_email_sender table),
// NOT in env.
//
// Read over POSTGRES first, not the Supabase REST API. Both hit the same
// database, but they are different service paths that fail independently: when
// the Supabase project exceeded its free-tier quota (2026-07-22) REST began
// returning 402 while Postgres kept working — silently killing ALL store email
// (order confirmation, OTP, password reset), because this lookup returned null
// and every caller correctly skips sending when there is no sender. Postgres is
// the connection Medusa already depends on, so if it is down the store is down
// anyway. REST is retained only as a fallback.
//
// Returns null when:
//   - Supabase env is missing, or
//   - no sender row exists, or
//   - the row is incomplete for its provider.
// In every null case, callers MUST skip sending — there is no env fallback,
// by design, so a misconfigured/empty sender means no email goes out.

let cached: TransportConfig | null = null
let cacheTime = 0
let hasCache = false
const CACHE_TTL = 60 * 1000 // 1 minute

function toConfig(row: any): TransportConfig | null {
  if (!row?.from_email) return null

  const from = row.from_name
    ? `${row.from_name} <${row.from_email}>`
    : row.from_email

  if (row.provider === "resend") {
    if (!row.resend_api_key) return null
    return {
      type: "resend",
      from,
      resend_api_key: row.resend_api_key,
    }
  }

  if (row.provider === "gmail") {
    if (!row.gmail_user || !row.gmail_app_password) return null
    return {
      type: "gmail",
      from,
      gmail_user: row.gmail_user,
      gmail_app_password: row.gmail_app_password,
    }
  }

  if (row.provider === "smtp") {
    if (!row.smtp_host || !row.smtp_user || !row.smtp_pass) return null
    return {
      type: "smtp",
      from,
      smtp_host: row.smtp_host,
      smtp_port: row.smtp_port ? Number(row.smtp_port) : 587,
      smtp_user: row.smtp_user,
      smtp_pass: row.smtp_pass,
      smtp_secure: !!row.smtp_secure,
    }
  }

  return null
}

// One small pool for the whole process. Email sends are infrequent, so this is
// deliberately tiny — it must never compete with Medusa's own connections.
let pool: Pool | null = null
function getPool(): Pool | null {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null
  pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    // Supabase requires TLS; the pooler presents a cert we don't pin.
    ssl: connectionString.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined,
  })
  pool.on("error", () => {
    /* never let an idle-client error crash the process */
  })
  return pool
}

/** Primary path: read the sender row straight from Postgres. */
async function readFromPostgres(): Promise<{ ok: boolean; row: any }> {
  const p = getPool()
  if (!p) return { ok: false, row: null }
  try {
    const { rows } = await p.query("select * from cms_email_sender limit 1")
    return { ok: true, row: rows[0] ?? null }
  } catch {
    return { ok: false, row: null }
  }
}

/** Fallback path: the Supabase REST API (subject to project quota limits). */
async function readFromRest(): Promise<{ ok: boolean; row: any }> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { ok: false, row: null }
  try {
    const supabase = createClient(url, key)
    const { data, error } = await supabase
      .from("cms_email_sender")
      .select("*")
      .limit(1)
      .maybeSingle()
    if (error) return { ok: false, row: null }
    return { ok: true, row: data }
  } catch {
    return { ok: false, row: null }
  }
}

export async function getEmailSender(
  forceRefresh = false
): Promise<TransportConfig | null> {
  if (!forceRefresh && hasCache && Date.now() - cacheTime < CACHE_TTL) {
    return cached
  }

  let result = await readFromPostgres()
  if (!result.ok) result = await readFromRest()

  // Don't cache an infrastructure failure as a real "no sender" answer —
  // otherwise a transient blip mutes email for the whole cache window.
  if (!result.ok) return cached

  cached = toConfig(result.row)
  cacheTime = Date.now()
  hasCache = true
  return cached
}
