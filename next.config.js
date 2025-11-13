/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Optimisations pour Vercel
  swcMinify: true,
  reactStrictMode: true,
  experimental: {
    isrMemoryCacheSize: 0,
  },
  // Exclure puppeteer et chromium du bundling (uniquement serveur)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclure ces modules du bundling client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'puppeteer': false,
        'puppeteer-core': false,
        '@sparticuz/chromium': false,
      };
    }
    return config;
  },
}

module.exports = nextConfig






