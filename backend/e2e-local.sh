#!/usr/bin/env bash
# Run any command against the LOCAL e2e environment instead of production.
#
# Why this exists: node_modules/.bin/medusa calls require("dotenv").config()
# before anything else, loading the LIVE .env into process.env. dotenv never
# overwrites an already-set key, so medusa-config.ts's loadEnv('test') CANNOT
# override it — `NODE_ENV=test npx medusa db:migrate` silently connects to
# production Supabase. Exporting .env.test into the shell first is the only
# reliable override, because real environment variables beat dotenv entirely.
#
# Usage:
#   ./e2e-local.sh npm run dev
#   ./e2e-local.sh npx medusa exec ./src/scripts/seed.ts
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env.test ]; then
  echo "ERROR: backend/.env.test is missing — refusing to run." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.test
set +a

# Fail closed. If .env.test ever stops overriding, we must not touch prod.
case "${DATABASE_URL:-}" in
  *supabase*|*pooler*)
    echo "ABORT: DATABASE_URL resolved to a Supabase/production host." >&2
    exit 1
    ;;
esac
case "${RAZORPAY_KEY_ID:-}" in
  rzp_live*)
    echo "ABORT: live Razorpay key resolved in a local e2e run." >&2
    exit 1
    ;;
esac
if [ "${SHIPROCKET_SIMULATE:-}" != "true" ]; then
  echo "ABORT: SHIPROCKET_SIMULATE is not true — the real courier account could be hit." >&2
  exit 1
fi

echo "[e2e-local] db=${DATABASE_URL##*/}  shiprocket=simulated  razorpay=${RAZORPAY_KEY_ID}"
exec "$@"
