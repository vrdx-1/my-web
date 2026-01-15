import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pkvtwuwicjgodkyraune.supabase.co',
        port: '',
        pathname: '/**', // อนุญาตทุก path
      },
    ],
  },
};

export default nextConfig;
