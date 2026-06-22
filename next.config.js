/** @type {import('next').NextConfig} */
const nextConfig = {
  // ethers v6 is ESM — tell Next.js to transpile it
  transpilePackages: ['ethers'],

  // Image domains if needed
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.binance.com' },
      { protocol: 'https', hostname: 'bin.bnbstatic.com' },
    ],
  },
}

module.exports = nextConfig