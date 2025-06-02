/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for static export which is better for Tauri
  output: 'export',
  // Disable image optimization since we're running locally
  images: { unoptimized: true },
  
  experimental: {
    // Optimize package imports
    optimizePackageImports: [
      'framer-motion',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      'date-fns'
    ],
  },

  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  // Disable server components for Tauri
  reactStrictMode: true,
  
  // Webpack config only for production builds
  webpack: (config, { dev }) => {
    // Skip webpack optimizations in development when using Turbopack
    if (dev) {
      return config;
    }
    
    // Optimize bundle size for production
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 70000,
        cacheGroups: {
          commons: {
            test: /[\\\\/]node_modules[\\\\/]/,
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
