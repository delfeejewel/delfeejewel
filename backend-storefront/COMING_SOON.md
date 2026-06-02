# Coming-soon mode

Pre-launch holding page for the storefront. Lives at `/coming-soon`. When
`COMING_SOON_MODE=true`, the middleware redirects every public request to it.

## What it does

- Branded landing page (plum + gold + Wittgenstein, matches the rest of the site)
- Rotating teaser carousel
- Email capture form → POST `/api/notify-launch` → Supabase `launch_signups` table
- Idempotent: duplicate emails return success without revealing the duplicate
- Self-contained — works even if the Medusa backend is offline

## Going live with the holding page

1. **Create the Supabase table** — run the SQL once in the Supabase SQL editor:
   ```bash
   # path: backend-storefront/sql/launch_signups.sql
   ```
   It creates the `launch_signups` table + a unique index on `lower(email)` +
   enables RLS. Safe to re-run.

2. **Set env vars** on the storefront host (Vercel / wherever):
   ```
   COMING_SOON_MODE=true
   COMING_SOON_QA_TOKEN=<some-long-random-string>     # optional, for QA bypass
   SUPABASE_URL=<your project url>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   NEXT_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com    # optional
   ```

   `COMING_SOON_QA_TOKEN` is what lets you preview the real site while the
   world sees the holding page. Pick something hard to guess.

3. **Deploy.** Every URL (except the carve-outs below) will 307-redirect to
   `/coming-soon`. The Medusa admin at `/admin` is still reachable so the
   team can configure products, etc.

## QA bypass — preview the real site while coming-soon is on

Visit any storefront URL with `?qa=<COMING_SOON_QA_TOKEN>` once:

```
https://yourdomain.com/?qa=your-token-here
```

That sets a `qa_bypass=1` cookie (30-day max-age) and reloads to the same URL
without the param. From then on, your browser sees the live site. Clear the
cookie to go back to the coming-soon experience.

## Carve-outs (always served, even with kill-switch on)

| Path | Why |
|---|---|
| `/coming-soon` | The page itself |
| `/api/notify-launch` | Email signup endpoint |
| `/admin/*` | Medusa admin |
| `/_next/*` | Next.js framework assets |
| `/favicon`, `/images`, `/robots`, `/sitemap` | Static files |
| Anything with a `.` in the path | Static assets |

## Going live for real (turn coming-soon off)

Unset the env var (or set to anything other than `"true"`) and redeploy:

```
COMING_SOON_MODE=
```

The middleware fall-through resumes the normal region-detection flow.

## Pulling the signup list

```sql
select email, source, created_at
from public.launch_signups
order by created_at desc;
```

Or dump to CSV from the Supabase dashboard. Use this to send the launch
announcement email when you're ready.

## What if Supabase isn't configured?

The API route degrades gracefully — it logs the email to the server console
and still returns success to the user. Useful for testing locally before
you've created the table.

## Files

- `src/app/coming-soon/page.tsx` + `client.tsx` — the page UI
- `src/app/api/notify-launch/route.ts` — email capture endpoint
- `src/middleware.ts` — kill-switch + QA bypass logic
- `sql/launch_signups.sql` — Supabase table migration
