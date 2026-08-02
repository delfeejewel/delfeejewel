import { Pool } from "pg"

/**
 * Direct Postgres access to the CMS tables.
 *
 * The CMS lives in the same database Medusa uses, reachable two ways: the
 * Supabase REST API, and Postgres. They fail independently — when the Supabase
 * project exceeded its quota, REST returned 402 while Postgres kept serving —
 * so anything the store *needs* reads over Postgres and treats REST as the
 * fallback. If Postgres is down the store is down anyway.
 *
 * One tiny pool for the whole process, shared by every CMS reader. These
 * lookups are infrequent and cached; the pool must never compete with Medusa's
 * own connections (the Supabase pooler caps session-mode clients).
 */
let pool: Pool | null = null

/**
 * Supabase's pooler serves session mode on 5432 and transaction mode on 6543.
 * Session mode caps the whole project at ~15 clients and Medusa's own pool
 * takes most of them, so a CMS read on 5432 loses the race and errors with
 * "max clients reached" — which is exactly how invoices ended up printing
 * "GSTIN N/A". These are single short SELECTs with no transaction state, so
 * transaction mode is both correct and far less contended.
 */
function toTransactionPooler(cs: string): string {
  return cs.includes("pooler.supabase.com:5432")
    ? cs.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543")
    : cs
}

function getPool(): Pool | null {
  if (pool) return pool
  const raw = process.env.DATABASE_URL
  if (!raw) return null
  const connectionString = toTransactionPooler(raw)
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

/**
 * Reads the first row of a CMS table.
 *
 * `ok` distinguishes "asked and there is no row" from "couldn't ask" — callers
 * must not cache the second as if it were an answer.
 *
 * The table name is interpolated, so it must never come from user input; every
 * caller passes a literal.
 */
export async function readCmsRow(
  table: string
): Promise<{ ok: boolean; row: any }> {
  const p = getPool()
  if (!p) return { ok: false, row: null }
  try {
    const { rows } = await p.query(`select * from ${table} limit 1`)
    return { ok: true, row: rows[0] ?? null }
  } catch {
    return { ok: false, row: null }
  }
}
