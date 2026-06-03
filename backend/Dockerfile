# Prebuilt Medusa backend image.
#
# Built on a machine with adequate RAM (your Mac) so `npm ci` + `medusa build`
# run without the cloud-builder OOM. Deploy this image to any container host;
# runtime secrets (DATABASE_URL, JWT_SECRET, Razorpay keys, etc.) are injected
# by the HOST at run time — they are NOT baked into the image.
FROM node:22-bookworm

WORKDIR /app

# Install deps first for better layer caching. (bookworm has build tools for
# any native addons, e.g. argon2.)
COPY package.json package-lock.json ./
# --loglevel=http surfaces the exact URL being fetched (so a stall is diagnosable);
# resilience flags keep a flaky fetch from hanging forever.
RUN npm ci --no-audit --no-fund --loglevel=http --fetch-retries=5 --fetch-timeout=120000

# Copy the rest of the source and build. Admin UI is disabled — the API +
# storefront don't need it, and it keeps the build light.
COPY . .
ENV DISABLE_ADMIN=true
RUN npm run build

ENV NODE_ENV=production
# Medusa listens on $PORT if the host injects one, otherwise 9000.
EXPOSE 9000

# Run migrations then start. Mirrors railway.toml. Env comes from the host.
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
