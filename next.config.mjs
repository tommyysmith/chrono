/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for static export which is better for Tauri
  output: 'export',
  // Disable image optimization since we're running locally
  images: { unoptimized: true },
  // Optimize bundle for production
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      'date-fns'
    ]
  },
  // Disable server components for Tauri
  reactStrictMode: true,
  webpack: (config) => {
    // Optimize bundle size
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 70000,
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };
    return config;
  },
}

export default nextConfig;
