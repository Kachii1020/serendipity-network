import type { MetadataRoute } from "next";

const origin = process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: ["/api/", "/phase0"],
      userAgent: "*",
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
