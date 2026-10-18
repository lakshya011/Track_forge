import type { NextConfig } from "next";

/**
 * The app is fully static, so it is exported to `out/` and can be served from any static host.
 * GitHub Pages serves project sites under `/<repo>/`; the workflow sets NEXT_PUBLIC_BASE_PATH to
 * that prefix. Locally and on Vercel the variable is unset and nothing changes.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
