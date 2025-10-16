import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't use 'export' output - we need API routes for Electron auth
  images: {
    unoptimized: true,
  },
  // Disable trailing slash for Electron compatibility
  trailingSlash: true,
  // Enable standalone output for Electron packaging
  output: 'standalone',
};

export default nextConfig;
