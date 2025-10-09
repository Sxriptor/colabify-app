import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Disable trailing slash for Electron compatibility
  trailingSlash: true,
};

export default nextConfig;
