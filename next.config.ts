
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ✅ ADDED: Define environment variables for the application
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NODE_ENV === 'production'
      ? 'https://your-production-app.com' // Replace with your actual production URL
      : 'https://6000-firebase-studio-1765412736426.cluster-yylgzpipxrar4v4a72liastuqy.cloudworkstations.dev',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'autoplay=*, encrypted-media=*, accelerometer=*, gyroscope=*, web-share=*'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
