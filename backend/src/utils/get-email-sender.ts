import { createClient } from "@supabase/supabase-js"
import { TransportConfig } from "../modules/email_notification/transport"

// The outbound email sender is configured in the CMS (cms_email_sender table),
// NOT in env. This reads that single-row config via the Supabase service-role
// key (bypasses RLS) and maps it to a nodemailer TransportConfig.
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

export async function getEmailSender(
  forceRefresh = false
): Promise<TransportConfig | null> {
  if (!forceRefresh && hasCache && Date.now() - cacheTime < CACHE_TTL) {
    return cached
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Don't cache an env-misconfiguration as a real "no sender" result.
  if (!url || !key) return null

  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from("cms_email_sender")
    .select("*")
    .limit(1)
    .maybeSingle()

  cached = error ? null : toConfig(data)
  cacheTime = Date.now()
  hasCache = true
  return cached
}
