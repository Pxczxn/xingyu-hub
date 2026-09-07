import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:7779/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
