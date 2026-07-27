import type { NextConfig } from "next";

/* DEMO_STATIC=1 produces a fully static bundle in out/ for S3 + CloudFront.
   Static export cannot coexist with route handlers or proxy middleware, so
   scripts/build-demo-static.mjs moves those aside for the duration of the
   build. Demo mode answers every /api/* call in the browser, so nothing in
   the exported bundle needs a server. */
const isStaticDemo = process.env.DEMO_STATIC === "1";

const nextConfig: NextConfig = {
  ...(isStaticDemo
    ? {
        output: "export" as const,
        // There is no Next.js image optimizer on a static host.
        images: { unoptimized: true },
        // Emit /chat/index.html rather than /chat.html so CloudFront can serve
        // directory-style URLs with a simple rewrite.
        trailingSlash: true,
      }
    : {}),
  turbopack: {
    // better-sqlite3 is a native Node addon — never bundle it for browser
    resolveAlias: {
      "better-sqlite3": { browser: "./src/lib/db-browser-stub.ts" },
    },
  },
};

export default nextConfig;
