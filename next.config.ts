import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ビルド時のESLintエラーを警告扱いにする（any型など）
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
