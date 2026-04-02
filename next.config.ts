import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        // Firebase Storage（アップロードしたアイコン画像）
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        // Google アカウントのプロフィール画像
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
