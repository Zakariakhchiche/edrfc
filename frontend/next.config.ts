import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      // In production on Vercel, proxy /api/* to the backend service
      return [
        {
          source: "/api/:path*",
          destination: "/_/backend/api/:path*",
        },
      ];
    }
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
