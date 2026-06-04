# Medusa backend image (API + admin at /app).
#
# Built in GitHub Actions (or locally on a machine with adequate RAM) so
# `npm ci` + `medusa build` run without the cloud-builder OOM, then pushed to
# GHCR and pulled by the droplet. Runtime secrets (DATABASE_URL, JWT_SECRET,
# Razorpay keys, etc.) are injected by the HOST at run time — never baked in.
FROM node:22-bookworm

WORKDIR /app

# Install deps first for better layer caching. (bookworm has build tools for
# any native addons, e.g. argon2.)
COPY package.json package-lock.json ./
# --loglevel=http surfaces the exact URL being fetched (so a stall is diagnosable);
# resilience flags keep a flaky fetch from hanging forever.
RUN npm ci --no-audit --no-fund --loglevel=http --fetch-retries=5 --fetch-timeout=120000

# Copy the rest of the source and build. Admin UI is COMPILED IN (served at
# /app) — DISABLE_ADMIN is intentionally unset. The admin Vite build is heap-
# heavy; cap Node's old-space so it doesn't OOM (exit 134) on smaller builders.
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=3584" npm run build

ENV NODE_ENV=production
# Medusa listens on $PORT if the host injects one, otherwise 9000.
EXPOSE 9000

# The production build lands in .medusa/server. The admin bundle
# (.medusa/server/public/admin/index.html) is ONLY served when the server runs
# from inside that dir — running from /app crash-loops "Could not find
# index.html in the admin build directory" once admin is enabled. So install
# prod deps there and start from there.
WORKDIR /app/.medusa/server
RUN npm install --omit=dev

# Run migrations then start. Env comes from the host at run time.
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
