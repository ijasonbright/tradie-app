/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@tradie-app/database', '@tradie-app/utils'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
    ],
  },
}

module.exports = nextConfig
