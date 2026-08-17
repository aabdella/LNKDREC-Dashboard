import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // pdf-inspector is a native NAPI module — must be external, not bundled
  serverExternalPackages: ["@firecrawl/pdf-inspector"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
