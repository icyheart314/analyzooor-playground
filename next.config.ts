import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Ignore ESLint errors during builds for deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore TypeScript errors during builds for deployment
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
