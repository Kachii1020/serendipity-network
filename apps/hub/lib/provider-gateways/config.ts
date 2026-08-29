import "server-only";

import type { Provider } from "@serendipity/contracts";
import {
  parseExactOrigin,
  parseExactOrigins,
  providerSlugs,
} from "@serendipity/provider-config";

export type HubProviderGatewayEnv = {
  hubOrigin: string;
  interserviceSecret: string;
  providerOrigins: Record<Provider, string>;
};

const requireValue = (
  source: Record<string, string | undefined>,
  name: string,
): string => {
  const value = source[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export const readHubProviderGatewayEnv = (
  source: Record<string, string | undefined> = process.env,
): HubProviderGatewayEnv => {
  const origins = parseExactOrigins(
    requireValue(source, "NEXT_PUBLIC_PROVIDER_ORIGINS"),
  );
  if (origins.length !== providerSlugs.length) {
    throw new Error(
      "NEXT_PUBLIC_PROVIDER_ORIGINS must list Kiln, Nori, and Loop in that order",
    );
  }
  const interserviceSecret = requireValue(source, "HUB_INTERSERVICE_SECRET");
  if (Buffer.byteLength(interserviceSecret) < 32) {
    throw new Error("HUB_INTERSERVICE_SECRET must contain at least 32 bytes");
  }
  return {
    hubOrigin: parseExactOrigin(requireValue(source, "NEXT_PUBLIC_HUB_ORIGIN")),
    interserviceSecret,
    providerOrigins: Object.fromEntries(
      providerSlugs.map((provider, index) => [provider, origins[index]!]),
    ) as Record<Provider, string>,
  };
};
