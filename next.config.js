/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  serverExternalPackages: ['xlsx'],
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig
