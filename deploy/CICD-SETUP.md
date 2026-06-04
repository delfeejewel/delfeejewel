# CI/CD setup — push to deploy

`.github/workflows/deploy.yml` runs on every push to `main` that touches
`backend/`, `backend-storefront/`, or `deploy/docker-compose.yml`. It builds both
images on the GitHub runner (no droplet OOM), pushes them to GHCR, then SSHes
into the droplet to `docker compose pull && up -d` and health-checks the result.

This workflow must live in the **client repo `delfeejewel/delfeejewel`** so the
built-in `GITHUB_TOKEN` can push to the `ghcr.io/delfeejewel/*` package namespace
without a cross-org PAT.

## 1. GitHub repo secrets

Settings → Secrets and variables → Actions → **New repository secret**.

### Storefront build-time (baked into the image — `NEXT_PUBLIC_*`)
| Secret | Value |
|---|---|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | storefront publishable key (`pk_…`) |
| `NEXT_PUBLIC_BASE_URL` | `https://delfee.in` |
| `NEXT_PUBLIC_DEFAULT_REGION` | `in` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_SwudVQQc1jthmk` (→ `rzp_live_…` at launch) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `https://api.delfee.in` |

> Changing any of these requires a **rebuild** (they're compiled in), which the
> next push triggers automatically.

### Deploy (SSH + GHCR pull on the droplet)
| Secret | Value |
|---|---|
| `DROPLET_HOST` | `168.144.24.176` |
| `DROPLET_USER` | `root` |
| `DROPLET_SSH_KEY` | private key of a **CI-only** deploy keypair (see step 2) |
| `GHCR_USERNAME` | `delfeejewel` (or any user with `read:packages`) |
| `GHCR_TOKEN` | a PAT with **`read:packages`** scope (droplet uses it to pull) |

## 2. One-time droplet prep

```bash
# On your Mac: make a dedicated CI deploy key (no passphrase)
ssh-keygen -t ed25519 -f ~/.ssh/delfee_ci_deploy -N "" -C "github-actions-deploy"

# Install the PUBLIC key on the droplet
ssh -i ~/.ssh/delfee_do_ed25519 root@168.144.24.176 \
  "cat >> ~/.ssh/authorized_keys" < ~/.ssh/delfee_ci_deploy.pub

# Put the PRIVATE key (full file contents) into the DROPLET_SSH_KEY secret
cat ~/.ssh/delfee_ci_deploy
```

On the droplet, confirm `/opt/delfee/` has:
- `backend.env` — **no** `DISABLE_ADMIN=true`; `ADMIN_CORS` includes `https://api.delfee.in`.
- `.env` — storefront runtime vars (`MEDUSA_BACKEND_URL=http://backend:9000`, `COMING_SOON_MODE`, etc.).
- `Caddyfile` — already present and issuing LE certs (the workflow does **not** touch it).

The workflow auto-retires the old `docker-compose.override.yml` (the from-source
admin build) to `.override.yml.disabled` on first run, since the GHCR backend
image now carries admin.

## 3. First run

Push to `main` (or use **Actions → Deploy to droplet → Run workflow**). Watch the
health-check step: it fails the deploy if `https://api.delfee.in/app` (admin),
`/health`, or `https://delfee.in/in` doesn't return 200 — so a bad build can't
silently take the site or admin down; the previous containers keep running.

## Rollback

Every build is also tagged with the commit SHA. To roll back on the droplet:

```bash
cd /opt/delfee
docker pull ghcr.io/delfeejewel/delfee-backend:<good-sha>
docker tag  ghcr.io/delfeejewel/delfee-backend:<good-sha> ghcr.io/delfeejewel/delfee-backend:latest
docker compose up -d backend   # same for delfee-storefront if needed
```
