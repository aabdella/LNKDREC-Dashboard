import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // pdf-inspector is a native NAPI module — mark external so Turbopack doesn't bundle it.
  // Dynamic import with try/catch handles the case where the native binding is unavailable.
  serverExternalPackages: ["@firecrawl/pdf-inspector"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
