import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // inline the (small) stylesheet into the HTML: one less render-blocking request
    inlineCss: true,
  },
};

export default nextConfig;
