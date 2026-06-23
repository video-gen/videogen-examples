import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This example lives inside a monorepo with multiple lockfiles, so Next.js
  // can't reliably infer the workspace root. Pin it to this app's directory.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
