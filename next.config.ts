import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Add configuration for larger file uploads
  experimental: {
    serverComponentsExternalPackages: ['@supabase/ssr'],
  },
  // Increase the body size limit for API routes
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
    responseLimit: false,
  },
  images: {
    domains: ['quizlabai.com', 'www.quizlabai.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'quizlabai.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.quizlabai.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
