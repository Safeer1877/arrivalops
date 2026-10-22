/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  devIndicators: false,
  env: {
    // On Vercel (or with this set to 1) the replay demo keeps each visitor's board in their own browser.
    NEXT_PUBLIC_ARRIVALOPS_IN_BROWSER: process.env.NEXT_PUBLIC_ARRIVALOPS_IN_BROWSER ?? (process.env.VERCEL ? '1' : ''),
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
