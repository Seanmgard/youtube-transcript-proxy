import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  
  // External packages for server components
  serverExternalPackages: ['@vercel/blob'],

  images: {
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
      {
        protocol: 'https',
        hostname: '8gw01lugjr5wsfvx.public.blob.vercel-storage.com',
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
      // Add specific headers for API routes to handle larger uploads
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
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
