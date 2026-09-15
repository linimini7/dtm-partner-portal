import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image Fly.io builds from.
  output: "standalone",
  experimental: {
    serverActions: {
      // Default 1MB is too small for a real LinkedIn-ready media kit image
      // upload. 32MB comfortably covers a single high-res image and also a
      // .zip bundle of several partner logos uploaded at once.
      bodySizeLimit: "32mb",
    },
  },
  turbopack: {
    // Silences Turbopack's root-inference warning: it walks up looking for
    // a lockfile and finds one in the home directory since this project is
    // one of several siblings under ~/Documents/Claude DTM.
    root: __dirname,
  },
};

export default nextConfig;
