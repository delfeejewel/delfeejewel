const checkEnvVariables = require("./check-env-variables")

try {
  checkEnvVariables()
} catch (e) {
  // Allow build even if env vars are missing (CI/CD)
  console.warn("Environment variable check skipped:", e.message)
}

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  logging: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        // Cloudflare R2 — product media. Any *.r2.dev bucket subdomain, so the
        // hostname doesn't need changing if the bucket is ever recreated.
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        // Custom domain for R2, once DNS is pointed at the bucket. Harmless
        // while unused; saves a redeploy at the moment we switch off r2.dev.
        protocol: "https",
        hostname: "media.delfee.in",
      },
      {
        // Supabase Storage — legacy. Still referenced by products not yet
        // migrated to R2; remove once the migration is complete.
        protocol: "https",
        hostname: "xhsejjhzxqneoqzlbohv.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
