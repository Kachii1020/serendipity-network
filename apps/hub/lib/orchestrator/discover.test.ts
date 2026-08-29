import { composeBundles } from "@serendipity/bundle-engine";
import type { Provider, ProviderSearchData } from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { describe, expect, it } from "vitest";

import type {
  ProviderGateway,
  ProviderGatewayResult,
} from "../provider-gateways/types";
import { discoverAndCompose } from "./discover";

const completedAt = "2030-05-17T08:00:00Z";

const success = (
  provider: Provider,
): ProviderGatewayResult<ProviderSearchData> => ({
  ok: true,
  data: {
    inventoryAsOf: completedAt,
    provider,
    slots: canonicalSlotsByProvider[provider],
  },
  meta: {
    completedAt,
    correlationId: `search-${provider}`,
    origin: `https://${provider}.test`,
  },
});

const gateway = (
  result: ProviderGatewayResult<ProviderSearchData>,
): ProviderGateway => ({
  provider: result.ok
    ? result.data.provider
    : (result.error.provider ?? "kiln"),
  search: () => Promise.resolve(result),
  hold: () => Promise.reject(new Error("not used")),
  getHoldStatus: () => Promise.reject(new Error("not used")),
  confirm: () => Promise.reject(new Error("not used")),
  release: () => Promise.reject(new Error("not used")),
});

const canonicalGateways = (): Record<Provider, ProviderGateway> => ({
  kiln: gateway(success("kiln")),
  nori: gateway(success("nori")),
  loop: gateway(success("loop")),
});

describe("discoverAndCompose", () => {
  it("composes the canonical deterministic candidates from three Providers", async () => {
    const expected = await composeBundles({
      bundleVersion: 1,
      intent: canonicalIntent,
      slotsByProvider: canonicalSlotsByProvider,
      travelTimes: canonicalTravelTimes,
    });
    const result = await discoverAndCompose(canonicalIntent, {
      bundleSessionId: () => "bundle-session-canonical",
      bundleVersion: 1,
      gateways: canonicalGateways(),
      travelTimes: canonicalTravelTimes,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !expected.ok) throw new Error("expected candidates");
    expect(result.data.selectedBundle).toEqual(expected.candidates[0]);
    expect([result.data.selectedBundle, ...result.data.alternatives]).toEqual(
      expected.candidates,
    );
    expect(result.data.providerStatuses).toEqual({
      kiln: "ONLINE",
      nori: "ONLINE",
      loop: "ONLINE",
    });
    expect(result.session.intent).toEqual(canonicalIntent);
  });

  it("fails closed and marks a malformed Provider result invalid", async () => {
    const gateways = canonicalGateways();
    gateways.nori = gateway({
      ok: false,
      failureType: "invalid",
      error: {
        code: "VALIDATION_ERROR",
        message: "Provider result was invalid.",
        provider: "nori",
        retryable: false,
      },
    });
    const result = await discoverAndCompose(canonicalIntent, {
      bundleSessionId: () => "bundle-session-invalid",
      bundleVersion: 1,
      gateways,
      travelTimes: canonicalTravelTimes,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", provider: "nori" },
      providerStatuses: { kiln: "ONLINE", nori: "INVALID", loop: "ONLINE" },
    });
  });

  it("fails closed when one Provider is offline", async () => {
    const gateways = canonicalGateways();
    gateways.loop = gateway({
      ok: false,
      failureType: "offline",
      error: {
        code: "PROVIDER_TIMEOUT",
        message: "Provider timed out.",
        provider: "loop",
        retryable: true,
      },
    });
    const result = await discoverAndCompose(canonicalIntent, {
      bundleSessionId: () => "bundle-session-offline",
      bundleVersion: 1,
      gateways,
      travelTimes: canonicalTravelTimes,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PROVIDER_TIMEOUT", provider: "loop" },
      providerStatuses: { kiln: "ONLINE", nori: "ONLINE", loop: "OFFLINE" },
    });
  });

  it("returns NO_VALID_BUNDLE without inventing a partial route", async () => {
    const gateways = canonicalGateways();
    const loopSuccess = success("loop");
    if (!loopSuccess.ok) throw new Error("expected fixture success");
    gateways.loop = gateway({
      ...loopSuccess,
      data: {
        ...loopSuccess.data,
        provider: "loop",
        slots: [],
      },
    });
    const result = await discoverAndCompose(canonicalIntent, {
      bundleSessionId: () => "bundle-session-empty",
      bundleVersion: 1,
      gateways,
      travelTimes: canonicalTravelTimes,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NO_VALID_BUNDLE" },
      providerStatuses: { kiln: "ONLINE", nori: "ONLINE", loop: "ONLINE" },
    });
  });

  it("rejects invalid intent before calling any Provider", async () => {
    let calls = 0;
    const gateways = canonicalGateways();
    for (const provider of Object.keys(gateways) as Provider[]) {
      gateways[provider] = {
        ...gateways[provider],
        search: () => {
          calls += 1;
          return Promise.resolve(success(provider));
        },
      };
    }
    const result = await discoverAndCompose(
      { ...canonicalIntent, schemaVersion: "2" },
      {
        bundleSessionId: () => "bundle-session-invalid-input",
        bundleVersion: 1,
        gateways,
        travelTimes: canonicalTravelTimes,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_SCHEMA_VERSION" },
    });
    expect(calls).toBe(0);
  });
});
