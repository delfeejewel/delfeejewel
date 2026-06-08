import { loadEnv, defineConfig } from '@medusajs/framework/utils'

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

module.exports = defineConfig({
  admin: {
    disable: process.env.DISABLE_ADMIN === "true",
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
    {
      resolve: "./src/modules/email_notification",
    },
    {
      resolve: "./src/modules/wishlist",
    },
    {
      resolve: "./src/modules/contact",
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
              pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
              default_weight: 0.1, // 100g default for jewellery
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
