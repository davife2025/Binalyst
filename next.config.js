/** @type {import('next').NextConfig} */
const nextConfig = {
  // ethers v6 is ESM — tell Turbopack to transpile it
  transpilePackages: ['ethers'],

  // Silence the Turbopack "webpack config present" error
  turbopack: {},

  // Image domains if needed
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.binance.com' },
      { protocol: 'https', hostname: 'bin.bnbstatic.com' },
    ],
  },
}

module.exports = nextConfig
