import type { MetadataRoute } from "next";

const origin = process.env.NEXT_PUBLIC_HUB_ORIGIN ?? "http://localhost:3100";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "weekly",
      priority: 1,
      url: origin,
    },
  ];
}
