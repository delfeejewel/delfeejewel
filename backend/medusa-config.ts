import { loadEnv, defineConfig } from '@medusajs/framework/utils'

import { FAVICON_DATA_URI } from './src/admin/favicon-data'
import { ADMIN_THEME_CSS } from './src/admin/admin-theme'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Redis-backed infrastructure modules. Without REDIS_URL (e.g. local dev) we
// fall back to Medusa's in-memory cache / event bus / workflow engine. In
// production a shared Redis is strongly recommended: the in-memory workflow
// engine keeps all workflow state in a single Node process (lost on restart,
// not shared across instances) and the local event bus runs subscribers
// inline. Provision a Redis instance in the SAME region as the backend.
const REDIS_URL = process.env.REDIS_URL

const redisModules = REDIS_URL
  ? [
      {
        resolve: "@medusajs/medusa/cache-redis",
        options: { redisUrl: REDIS_URL },
      },
      {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: { redisUrl: REDIS_URL },
      },
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { url: REDIS_URL } },
      },
    ]
  : []

// File storage. By default (local dev) Medusa's built-in local provider stores
// uploads under ./static and serves them at `${backendUrl}/static/...` — which
// bakes a `http://localhost:9000` URL into every product image. That breaks in
// production (browsers can't reach localhost, and the container's ./static is
// ephemeral). When S3 credentials are present we register the S3 provider
// pointed at Supabase Storage (S3-compatible) so files persist with a correct
// public URL across every environment. No creds → fall back to local for dev.
const s3FileModule = process.env.S3_ENDPOINT
  ? [
      {
        resolve: "@medusajs/medusa/file",
        options: {
          providers: [
            {
              resolve: "@medusajs/file-s3",
              id: "s3",
              options: {
                file_url: process.env.S3_FILE_URL,
                access_key_id: process.env.S3_ACCESS_KEY_ID,
                secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                region: process.env.S3_REGION,
                bucket: process.env.S3_BUCKET,
                endpoint: process.env.S3_ENDPOINT,
                // Supabase Storage requires path-style addressing.
                additional_client_config: {
                  forcePathStyle: true,
                },
              },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  admin: {
    disable: process.env.DISABLE_ADMIN === "true",
    // Swap Medusa's empty placeholder favicon for the Delfee "Df" mark.
    // NOTE: Medusa applies this as mergeConfig(baseConfig, vite(baseConfig)),
    // and Vite's mergeConfig CONCATENATES plugin arrays — so we must return
    // ONLY our added plugin here. Returning the base config (or pushing onto
    // its plugins) would duplicate @vitejs/plugin-react and double-inject the
    // React Refresh preamble in dev ("inWebWorker has already been declared").
    vite: () => ({
      plugins: [
        {
          name: "delfee-admin-branding",
          transformIndexHtml(html: string) {
            return html
              .replace(
                /<link rel="icon"[^>]*data-placeholder-favicon[^>]*\/?>/,
                `<link rel="icon" type="image/png" href="${FAVICON_DATA_URI}" />`
              )
              // Inject the brand-accent theme after Medusa's stylesheet so it
              // wins; applies to every admin page.
              .replace(
                /<\/head>/,
                `<style id="delfee-admin-theme">${ADMIN_THEME_CSS}</style></head>`
              )
          },
        },
      ],
    }),
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    ...redisModules,
    ...s3FileModule,
    {
      resolve: "./src/modules/email_notification",
    },
    {
      resolve: "./src/modules/wishlist",
    },
    {
      resolve: "./src/modules/review",
    },
    {
      resolve: "./src/modules/gift_card",
    },
    {
      resolve: "./src/modules/return_request",
    },
    {
      resolve: "./src/modules/qr_code",
    },
    {
      resolve: "./src/modules/otp_verification",
    },
    {
      resolve: "./src/modules/marketing",
    },
    {
      resolve: "./src/modules/appointment",
    },
    {
      // Explicitly configure Auth so we can swap the stock emailpass provider
      // for our TOTP-aware subclass. Registered under id `emailpass` so all
      // login URLs are unchanged; non-enrolled users authenticate as before.
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "./src/modules/auth_emailpass_totp",
            id: "emailpass",
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/fulfillment-manual",
            id: "manual",
          },
          {
            resolve: "./src/modules/shiprocket",
            id: "shiprocket",
            options: {
              email: process.env.SHIPROCKET_EMAIL,
              password: process.env.SHIPROCKET_PASSWORD,
              // Address nickname in Shiprocket, not a pincode — the two are
              // used for different calls, so they're configured separately.
              pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
              pickup_pincode: process.env.SHIPROCKET_PICKUP_PINCODE,
              // Variant weights are catalogued in grams; declared parcel weight
              // is summed from the items, plus packaging tare.
              weight_unit: "g",
              default_weight: 0.1, // fallback: 100g, for variants with no weight
              packaging_weight: 0.05, // box + pouch
              default_dimensions: { length: 10, breadth: 8, height: 5 },
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/razorpay",
            id: "razorpay",
            options: {
              key_id: process.env.RAZORPAY_KEY_ID,
              key_secret: process.env.RAZORPAY_KEY_SECRET,
              webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
            },
          },
          {
            resolve: "./src/modules/cod",
            id: "cod",
            options: {},
          },
        ],
      },
    },
  ],
})
