import { composeBundles, type TravelTimes } from "@serendipity/bundle-engine";
import {
  PROVIDERS,
  SCHEMA_VERSION,
  contractValidators,
  validateIntent,
  type FindOptionsData,
  type Intent,
  type Provider,
  type ProviderSearchData,
  type ProviderSearchInput,
  type PublicError,
} from "@serendipity/contracts";

import type {
  ProviderGateway,
  ProviderGatewayResult,
} from "../provider-gateways/types";
import type { CandidateSession } from "../selection";

type ProviderStatuses = FindOptionsData["providerStatuses"];

export type DiscoverSuccess = {
  data: FindOptionsData;
  ok: true;
  session: CandidateSession;
};

export type DiscoverFailure = {
  error: PublicError;
  ok: false;
  providerStatuses: ProviderStatuses;
};

export type DiscoverOutcome = DiscoverSuccess | DiscoverFailure;

export type DiscoverDependencies = {
  bundleSessionId: () => string;
  bundleVersion: number;
  gateways: Record<Provider, ProviderGateway>;
  travelTimes: TravelTimes;
};

const safeFailure = (
  code: PublicError["code"],
  message: string,
  providerStatuses: ProviderStatuses,
  provider?: Provider,
): DiscoverFailure => ({
  error: {
    code,
    message,
    ...(provider ? { provider } : {}),
    retryable: [
      "NO_VALID_BUNDLE",
      "PROVIDER_OFFLINE",
      "PROVIDER_TIMEOUT",
      "TOOL_NOT_FOUND",
      "WEBMCP_UNAVAILABLE",
    ].includes(code),
  },
  ok: false,
  providerStatuses,
});

const offlineResult = (provider: Provider): ProviderGatewayResult<never> => ({
  error: {
    code: "PROVIDER_OFFLINE",
    message: "The Provider could not be reached.",
    provider,
    retryable: true,
  },
  failureType: "offline",
  ok: false,
});

const toSearchInput = (intent: Intent): ProviderSearchInput => ({
  schemaVersion: SCHEMA_VERSION,
  endAt: intent.endAt,
  excludedTags: intent.excludedTags,
  maxPriceYen: intent.totalBudgetYen,
  partySize: intent.partySize,
  preferredTags: intent.preferredTags,
  startAt: intent.startAt,
});

export const discoverAndCompose = async (
  input: unknown,
  dependencies: DiscoverDependencies,
  signal?: AbortSignal,
): Promise<DiscoverOutcome> => {
  const defaultStatuses: ProviderStatuses = {
    kiln: "OFFLINE",
    nori: "OFFLINE",
    loop: "OFFLINE",
  };
  const intent = validateIntent(input);
  if (!intent.ok) {
    return safeFailure(
      intent.code,
      "The discovery request did not match the current intent contract.",
      defaultStatuses,
    );
  }
  const searchInput = toSearchInput(intent.value);
  const settled = await Promise.all(
    PROVIDERS.map(async (provider) => {
      try {
        return {
          provider,
          result: await dependencies.gateways[provider].search(searchInput, {
            ...(signal ? { signal } : {}),
          }),
        };
      } catch {
        return { provider, result: offlineResult(provider) };
      }
    }),
  );

  const statuses = { ...defaultStatuses };
  const slotsByProvider = {} as Record<Provider, ProviderSearchData["slots"]>;
  let firstFailure:
    | {
        provider: Provider;
        result: Extract<ProviderGatewayResult<never>, { ok: false }>;
      }
    | undefined;

  for (const { provider, result } of settled) {
    if (!result.ok) {
      statuses[provider] =
        result.failureType === "invalid" ? "INVALID" : "OFFLINE";
      firstFailure ??= { provider, result };
      continue;
    }
    if (
      !contractValidators.providerSearchData(result.data) ||
      result.data.provider !== provider
    ) {
      statuses[provider] = "INVALID";
      firstFailure ??= {
        provider,
        result: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Provider search data was invalid.",
            provider,
            retryable: false,
          },
          failureType: "invalid",
          ok: false,
        },
      };
      continue;
    }
    statuses[provider] = "ONLINE";
    slotsByProvider[provider] = result.data.slots;
  }

  if (firstFailure) {
    return safeFailure(
      firstFailure.result.error.code,
      firstFailure.result.error.message,
      statuses,
      firstFailure.provider,
    );
  }

  const composed = await composeBundles({
    bundleVersion: dependencies.bundleVersion,
    intent: intent.value,
    slotsByProvider,
    travelTimes: dependencies.travelTimes,
  });
  if (!composed.ok) {
    return safeFailure(
      "NO_VALID_BUNDLE",
      "No complete three-stop route matches these constraints.",
      statuses,
    );
  }
  const selectedBundle = composed.candidates[0];
  if (!selectedBundle) {
    return safeFailure(
      "NO_VALID_BUNDLE",
      "No complete three-stop route matches these constraints.",
      statuses,
    );
  }
  const bundleSessionId = dependencies.bundleSessionId();
  const data: FindOptionsData = {
    alternatives: composed.candidates.slice(1),
    bundleSessionId,
    bundleVersion: dependencies.bundleVersion,
    providerStatuses: statuses,
    selectedBundle,
  };
  if (!contractValidators.findOptionsData(data)) {
    return safeFailure(
      "INTERNAL_ERROR",
      "The composed route violated the Hub result contract.",
      statuses,
    );
  }
  return {
    data,
    ok: true,
    session: {
      bundleSessionId,
      bundleVersion: dependencies.bundleVersion,
      candidates: composed.candidates,
      intent: intent.value,
      selectedBundleId: selectedBundle.bundleId,
    },
  };
};
