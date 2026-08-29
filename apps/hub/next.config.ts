import type { NextConfig } from "next";

const providerOrigins = (
  process.env.NEXT_PUBLIC_PROVIDER_ORIGINS ??
  "http://localhost:3101,http://localhost:3102,http://localhost:3103"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const quotedProviders = providerOrigins
  .map((origin) => `"${origin}"`)
  .join(" ");
const frameSources = providerOrigins.join(" ");

const config: NextConfig = {
  transpilePackages: [
    "@serendipity/bundle-engine",
    "@serendipity/contracts",
    "@serendipity/provider-config",
    "@serendipity/test-fixtures",
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
            value: `tools=(self ${quotedProviders})`,
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "connect-src 'self' ws: wss:",
              `frame-src 'self' ${frameSources}`,
              "frame-ancestors 'self'",
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
