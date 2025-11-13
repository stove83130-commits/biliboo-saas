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
  // Exclure puppeteer et chromium du bundling (Next.js 14+)
  serverComponentsExternalPackages: [
    'puppeteer',
    'puppeteer-core',
    '@sparticuz/chromium',
  ],
  // Exclure puppeteer et chromium du bundling Webpack
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Côté serveur: exclure complètement du bundling
      // Utiliser une fonction pour mieux gérer les externals
      const originalExternals = config.externals;
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals]),
        ({ request }, callback) => {
          if (
            request === 'puppeteer' ||
            request === 'puppeteer-core' ||
            request === '@sparticuz/chromium' ||
            request?.startsWith('puppeteer/') ||
            request?.startsWith('puppeteer-core/') ||
            request?.startsWith('@sparticuz/chromium/')
          ) {
            return callback(null, `commonjs ${request}`);
          }
          if (typeof originalExternals === 'function') {
            return originalExternals({ request }, callback);
          }
          callback();
        },
      ];
    } else {
      // Côté client: fallback à false
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






