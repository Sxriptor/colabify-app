import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't use 'export' output - we need API routes for Electron auth
  images: {
    unoptimized: true,
  },
  // Disable trailing slash for Electron compatibility
  trailingSlash: true,
};

export default nextConfig;
