/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      'date-fns'
    ],
  },
  reactStrictMode: true,
  images: {
    domains: [],
  },
}

export default nextConfig;
