import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/tenants/:path*",
        destination: "http://localhost:3001/api/tenants/:path*",
      },
      {
        source: "/api/health",
        destination: "http://localhost:3001/api/health",
      },
    ];
  },
};

export default nextConfig;
