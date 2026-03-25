import type { NextConfig } from "next";

const isCapacitorBuild = process.env.BUILD_TARGET === "capacitor";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isCapacitorBuild ? "export" : undefined,
  images: {
    unoptimized: isCapacitorBuild
  }
};

export default nextConfig;
