import type { Provider, ProviderHoldStatusData } from "@serendipity/contracts";
import { describe, expect, it } from "vitest";

import type {
  ProviderGateway,
  ProviderGatewayResult,
} from "../provider-gateways/types";
import type { LoadedHeldWorkflow } from "../server/workflow-persistence";
import { rehydrateBundleSession } from "./rehydrate";

const loaded = {
  candidateSession: {},
  heldSession: {
    browserSessionId: "20000000-0000-4000-8000-000000000001",
    bundle: { bundleId: "bundle-1" },
    bundleHoldId: "50000000-0000-4000-8000-000000000001",
    bundleSessionId: "50000000-0000-4000-8000-000000000001",
    expiresAt: "2030-05-17T09:01:20Z",
    providerHolds: ["kiln", "nori", "loop"].map((provider, index) => ({
      expiresAt: "2030-05-17T09:01:20Z",
      holdSafeReference: `safe-${index}`,
      provider: provider as Provider,
      slotId: `slot-${index}`,
    })),
  },
  rawTokens: {},
} as unknown as LoadedHeldWorkflow;

const gateways = (
  statuses: Record<Provider, ProviderHoldStatusData["status"]>,
): Record<Provider, ProviderGateway> =>
  Object.fromEntries(
    (["kiln", "nori", "loop"] as const).map((provider, index) => [
      provider,
      {
        provider,
        search: () => Promise.reject(new Error("not used")),
        hold: () => Promise.reject(new Error("not used")),
        getHoldStatus: () =>
          Promise.resolve({
            data: {
              expiresAt: loaded.heldSession.expiresAt,
              holdSafeReference: `safe-${index}`,
              provider,
              ...(statuses[provider] === "CONFIRMED"
                ? { reservationRef: `reservation-${provider}` }
                : {}),
              slotId: `slot-${index}`,
              status: statuses[provider],
            },
            meta: {
              completedAt: "2030-05-17T09:00:00Z",
              correlationId: `rehydrate-${provider}`,
              origin: `https://${provider}.test`,
            },
            ok: true,
          } satisfies ProviderGatewayResult<ProviderHoldStatusData>),
        confirm: () => Promise.reject(new Error("not used")),
        release: () => Promise.reject(new Error("not used")),
      },
    ]),
  ) as unknown as Record<Provider, ProviderGateway>;

describe("rehydrateBundleSession", () => {
  it("restores an owned active hold through authoritative Provider status", async () => {
    const result = await rehydrateBundleSession(
      loaded.heldSession.bundleSessionId,
      loaded.heldSession.browserSessionId,
      {
        createGateways: () =>
          gateways({ kiln: "HELD", nori: "HELD", loop: "HELD" }),
        load: () => Promise.resolve(loaded),
      },
    );
    expect(result).toMatchObject({
      ok: true,
      phase: "held",
      requiresFreshSearch: false,
    });
  });

  it("restores a confirmed receipt only when all Providers agree", async () => {
    const result = await rehydrateBundleSession(
      loaded.heldSession.bundleSessionId,
      loaded.heldSession.browserSessionId,
      {
        createGateways: () =>
          gateways({
            kiln: "CONFIRMED",
            nori: "CONFIRMED",
            loop: "CONFIRMED",
          }),
        load: () => Promise.resolve(loaded),
      },
    );
    expect(result).toMatchObject({ ok: true, phase: "confirmed" });
  });

  it("fails closed on mixed Provider states or the wrong browser owner", async () => {
    const mixed = await rehydrateBundleSession(
      loaded.heldSession.bundleSessionId,
      loaded.heldSession.browserSessionId,
      {
        createGateways: () =>
          gateways({ kiln: "CONFIRMED", nori: "HELD", loop: "CONFIRMED" }),
        load: () => Promise.resolve(loaded),
      },
    );
    expect(mixed).toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_INCONSISTENT" },
    });

    const missing = await rehydrateBundleSession(
      loaded.heldSession.bundleSessionId,
      "20000000-0000-4000-8000-000000000099",
      {
        createGateways: () =>
          gateways({ kiln: "HELD", nori: "HELD", loop: "HELD" }),
        load: () => Promise.resolve(null),
      },
    );
    expect(missing).toMatchObject({
      ok: false,
      error: { code: "BUNDLE_NOT_FOUND" },
    });
  });
});
