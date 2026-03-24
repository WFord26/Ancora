/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  serverExternalPackages: ['xlsx'],
  images: {
    domains: ['localhost', 'vercel.app'],
  },
}

module.exports = nextConfig
