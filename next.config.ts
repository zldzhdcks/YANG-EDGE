import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the attended local owner preview separate from an existing dev server.
  distDir: process.env.YANG_EDGE_OWNER_PREVIEW === '1' ? '.next-owner-preview' : '.next',
};

export default nextConfig;
