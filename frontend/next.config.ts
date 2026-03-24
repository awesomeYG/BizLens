import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.monkeycode-ai.online"],
  experimental: {
    serverActions: {
      allowedOrigins: ["*.monkeycode-ai.online"],
      bodySizeLimit: "10mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
