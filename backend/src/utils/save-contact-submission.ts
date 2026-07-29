import { Pool } from "pg"

// Persist a Contact Us message straight to Postgres.
//
// The storefront used to insert into `contact_submissions` itself using the
// Supabase anon key over the REST API. That path dies whenever the Supabase
// project exceeds its free-tier quota — REST starts answering 402 while
// Postgres keeps working — which silently broke the whole contact form even
// though the database was fine. Same failure mode, and same fix, as the email
// sender lookup in ./get-email-sender.ts: go over Postgres, which is the
// connection Medusa already depends on.
//
// The table lives in the CMS schema (created by
// cms-admin/supabase/create-contact-form.sql) and is read in CMS → Forms →
// Submissions, so writing it here keeps a single source of truth.

// One tiny pool for the whole process — submissions are infrequent and this
// must never compete with Medusa's own connections.
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

export type ContactSubmission = {
  name: string
  email: string
  phone?: string | null
  subject?: string | null
  message: string
}

/**
 * Insert a submission. Returns true when it was stored.
 *
 * Never throws — the caller decides what to do when persistence fails (the
 * route still sends the notification email, so a message is not lost).
 */
export async function saveContactSubmission(
  s: ContactSubmission
): Promise<boolean> {
  const p = getPool()
  if (!p) return false
  try {
    await p.query(
      `INSERT INTO contact_submissions (name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        s.name.slice(0, 200),
        s.email.slice(0, 200),
        s.phone?.slice(0, 50) || null,
        s.subject?.slice(0, 200) || null,
        s.message.slice(0, 5000),
      ]
    )
    return true
  } catch {
    return false
  }
}
