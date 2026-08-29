import type { NextConfig } from "next";

const slug = process.env.NEXT_PUBLIC_PROVIDER_SLUG ?? "kiln";
const hubOrigin = process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100";

const config: NextConfig = {
  distDir: process.env.VERCEL ? ".next" : `.next-${slug}`,
  transpilePackages: [
    "@serendipity/provider-config",
    "@serendipity/ui",
    "@serendipity/webmcp",
  ],
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "Origin-Agent-Cluster", value: "?1" },
          {
            key: "Permissions-Policy",
            value: `tools=(self "${hubOrigin}")`,
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "connect-src 'self' ws: wss:",
              `frame-ancestors 'self' ${hubOrigin}`,
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ]);
  },
};

export default config;
