export const providerSlugs = ["kiln", "nori", "loop"] as const;

export type ProviderSlug = (typeof providerSlugs)[number];

export interface ProviderConfig {
  readonly accent: string;
  readonly activities: readonly [string, string, string];
  readonly category: string;
  readonly displayName: string;
  readonly hero: string;
  readonly initialCapacity: number;
  readonly mark: "bowl" | "note" | "vessel";
  readonly slug: ProviderSlug;
  readonly tagline: string;
  readonly toolPrefix: ProviderSlug;
}

const configs: Record<ProviderSlug, ProviderConfig> = {
  kiln: {
    accent: "#55DB9C",
    activities: ["Beginner pottery", "Glaze lab", "Clay after dark"],
    category: "Creative workshop",
    displayName: "Kiln Studio",
    hero: "Make something tonight.",
    initialCapacity: 2,
    mark: "vessel",
    slug: "kiln",
    tagline: "Small-batch pottery in Shibuya.",
    toolPrefix: "kiln",
  },
  nori: {
    accent: "#FFD731",
    activities: ["Counter tasting", "Tea and pickles", "Late-night donburi"],
    category: "Seasonal food counter",
    displayName: "Nori Counter",
    hero: "Taste the side streets.",
    initialCapacity: 2,
    mark: "bowl",
    slug: "nori",
    tagline: "A tiny counter with a changing menu.",
    toolPrefix: "nori",
  },
  loop: {
    accent: "#FB8050",
    activities: ["Listening hour", "Deep-cut exchange", "Midnight ambient"],
    category: "Listening room",
    displayName: "Loop Room",
    hero: "Hear something unexpected.",
    initialCapacity: 2,
    mark: "note",
    slug: "loop",
    tagline: "Small-room sessions for curious ears.",
    toolPrefix: "loop",
  },
};

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseExactOrigin(value: string): string {
  if (value.includes("*")) {
    throw new Error("Origin wildcards are forbidden");
  }

  const parsed = new URL(value);
  const localHttp =
    parsed.protocol === "http:" && localHosts.has(parsed.hostname);

  if (parsed.protocol !== "https:" && !localHttp) {
    throw new Error(
      "Origin must use HTTPS; localhost HTTP is allowed for tests",
    );
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      "Expected an exact origin without credentials, path, or query",
    );
  }

  return parsed.origin;
}

export function parseExactOrigins(value: string): readonly string[] {
  const origins = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseExactOrigin);

  if (origins.length === 0) {
    throw new Error("At least one exact origin is required");
  }

  if (new Set(origins).size !== origins.length) {
    throw new Error("Duplicate origins are forbidden");
  }

  return origins;
}

export function resolveProviderConfig(value: string): ProviderConfig {
  if (!providerSlugs.includes(value as ProviderSlug)) {
    throw new Error(`Unknown Provider: ${value}`);
  }

  return configs[value as ProviderSlug];
}
