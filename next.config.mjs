/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['katex'],
  turbopack: {
    resolveAlias: {
      canvas: './empty-module.js',
    },
  },
}

export default nextConfig
