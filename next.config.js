/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    serverComponentsExternalPackages: ['xlsx'],
  },
  images: {
    domains: ['localhost', 'vercel.app'],
  },
}

module.exports = nextConfig
