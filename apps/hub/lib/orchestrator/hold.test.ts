import { composeBundles } from "@serendipity/bundle-engine";
import {
  type Provider,
  type ProviderHoldData,
  type ProviderHoldStatusData,
  type ProviderReleaseData,
} from "@serendipity/contracts";
import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { describe, expect, it, vi } from "vitest";

import type {
  ProviderGateway,
  ProviderGatewayResult,
  ProviderResultMeta,
} from "../provider-gateways/types";
import type { CandidateSession } from "../selection";
import { holdSelectedBundle } from "./hold";

const browserSessionId = "20000000-0000-4000-8000-000000000001";
const safeReferences: Record<Provider, string> = {
  kiln: "30000000-0000-4000-8000-000000000001",
  nori: "30000000-0000-4000-8000-000000000002",
  loop: "30000000-0000-4000-8000-000000000003",
};
const expiresAt: Record<Provider, string> = {
  kiln: "2030-05-17T09:01:30Z",
  nori: "2030-05-17T09:01:20Z",
  loop: "2030-05-17T09:01:40Z",
};

const meta = (provider: Provider): ProviderResultMeta => ({
  completedAt: "2030-05-17T09:00:00Z",
  correlationId: `hold-${provider}`,
  origin: `https://${provider}.test`,
});

const success = <T>(provider: Provider, data: T): ProviderGatewayResult<T> => ({
  data,
  meta: meta(provider),
  ok: true,
});

const failure = (
  provider: Provider,
  code: "PROVIDER_TIMEOUT" | "SLOT_UNAVAILABLE",
): ProviderGatewayResult<never> => ({
  error: {
    code,
    message: code === "PROVIDER_TIMEOUT" ? "Timed out." : "Unavailable.",
    provider,
    retryable: true,
  },
  failureType: code === "PROVIDER_TIMEOUT" ? "offline" : "provider",
  ok: false,
});

const fixture = async (): Promise<CandidateSession> => {
  const composed = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!composed.ok || !composed.candidates[0]) {
    throw new Error("canonical candidates missing");
  }
  return {
    bundleSessionId: "50000000-0000-4000-8000-000000000001",
    bundleVersion: 1,
    candidates: composed.candidates,
    intent: canonicalIntent,
    selectedBundleId: composed.candidates[0].bundleId,
  };
};

type GatewayOverrides = {
  hold?: ProviderGateway["hold"];
  status?: ProviderGateway["getHoldStatus"];
  release?: ProviderGateway["release"];
};

const createGateway = (
  provider: Provider,
  overrides: GatewayOverrides = {},
): ProviderGateway => ({
  provider,
  search: () => Promise.reject(new Error("not used")),
  hold:
    overrides.hold ??
    ((input) =>
      Promise.resolve(
        success<ProviderHoldData>(provider, {
          expiresAt: expiresAt[provider],
          holdSafeReference: safeReferences[provider],
          provider,
          slotId: input.slotId,
          status: "HELD",
        }),
      )),
  getHoldStatus:
    overrides.status ??
    ((input) =>
      Promise.resolve(
        success<ProviderHoldStatusData>(provider, {
          expiresAt: expiresAt[provider],
          holdSafeReference:
            input.holdSafeReference ??
            input.clientRequestId ??
            safeReferences[provider],
          provider,
          slotId: canonicalSlotsByProvider[provider][0]!.slotId,
          status: "HELD",
        }),
      )),
  confirm: () => Promise.reject(new Error("not used")),
  release:
    overrides.release ??
    ((input) =>
      Promise.resolve(
        success<ProviderReleaseData>(provider, {
          capacityRestored: true,
          holdSafeReference: input.holdSafeReference,
          provider,
          slotId: canonicalSlotsByProvider[provider][0]!.slotId,
          status: "RELEASED",
        }),
      )),
});

const gateways = (
  overrides: Partial<Record<Provider, GatewayOverrides>> = {},
): Record<Provider, ProviderGateway> => ({
  kiln: createGateway("kiln", overrides.kiln),
  nori: createGateway("nori", overrides.nori),
  loop: createGateway("loop", overrides.loop),
});

describe("holdSelectedBundle", () => {
  it("holds all three Providers in parallel and returns the earliest expiry", async () => {
    const session = await fixture();
    const result = await holdSelectedBundle(
      {
        browserSessionId,
        bundleId: session.selectedBundleId,
        bundleSession: session,
        bundleVersion: 1,
      },
      {
        bundleHoldId: () => "60000000-0000-4000-8000-000000000001",
        clientRequestId: (provider) => safeReferences[provider],
        gateways: gateways(),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected held bundle");
    expect(result.data.expiresAt).toBe(expiresAt.nori);
    expect(result.data.providerHolds.map(({ provider }) => provider)).toEqual([
      "kiln",
      "nori",
      "loop",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/holdToken|idempotencyKey/i);
  });

  it("recovers a lost hold response by safe request reference", async () => {
    const session = await fixture();
    const status = vi.fn<ProviderGateway["getHoldStatus"]>((input) =>
      Promise.resolve(
        success<ProviderHoldStatusData>("kiln", {
          expiresAt: expiresAt.kiln,
          holdSafeReference: input.clientRequestId!,
          provider: "kiln",
          slotId: session.candidates[0]!.items[0]!.slot.slotId,
          status: "HELD",
        }),
      ),
    );
    const result = await holdSelectedBundle(
      {
        browserSessionId,
        bundleId: session.selectedBundleId,
        bundleSession: session,
        bundleVersion: 1,
      },
      {
        bundleHoldId: () => "60000000-0000-4000-8000-000000000001",
        clientRequestId: (provider) => safeReferences[provider],
        gateways: gateways({
          kiln: {
            hold: () => Promise.resolve(failure("kiln", "PROVIDER_TIMEOUT")),
            status,
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
    expect(status).toHaveBeenCalledWith(
      expect.objectContaining({ clientRequestId: safeReferences.kiln }),
      expect.any(Object),
    );
  });

  it("FAULT-NORI-DISAPPEARS compensates every successful hold and returns an unheld replacement", async () => {
    const session = await fixture();
    const releaseKiln = vi.fn<ProviderGateway["release"]>((input) =>
      Promise.resolve(
        success<ProviderReleaseData>("kiln", {
          capacityRestored: true,
          holdSafeReference: input.holdSafeReference,
          provider: "kiln",
          slotId: session.candidates[0]!.items[0]!.slot.slotId,
          status: "RELEASED",
        }),
      ),
    );
    const releaseLoop = vi.fn<ProviderGateway["release"]>((input) =>
      Promise.resolve(
        success<ProviderReleaseData>("loop", {
          capacityRestored: true,
          holdSafeReference: input.holdSafeReference,
          provider: "loop",
          slotId: session.candidates[0]!.items[2]!.slot.slotId,
          status: "RELEASED",
        }),
      ),
    );
    const result = await holdSelectedBundle(
      {
        browserSessionId,
        bundleId: session.selectedBundleId,
        bundleSession: session,
        bundleVersion: 1,
      },
      {
        bundleHoldId: () => "60000000-0000-4000-8000-000000000001",
        clientRequestId: (provider) => safeReferences[provider],
        gateways: gateways({
          kiln: { release: releaseKiln },
          nori: {
            hold: () => Promise.resolve(failure("nori", "SLOT_UNAVAILABLE")),
          },
          loop: { release: releaseLoop },
        }),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      compensationComplete: true,
      error: { code: "SLOT_UNAVAILABLE", provider: "nori" },
    });
    expect(releaseKiln).toHaveBeenCalledOnce();
    expect(releaseLoop).toHaveBeenCalledOnce();
    if (result.ok) throw new Error("expected compensated failure");
    expect(result.replacementBundle?.bundleId).not.toBe(
      session.selectedBundleId,
    );
  });

  it("reports incomplete compensation and never exposes a held result", async () => {
    const session = await fixture();
    const result = await holdSelectedBundle(
      {
        browserSessionId,
        bundleId: session.selectedBundleId,
        bundleSession: session,
        bundleVersion: 1,
      },
      {
        bundleHoldId: () => "60000000-0000-4000-8000-000000000001",
        clientRequestId: (provider) => safeReferences[provider],
        gateways: gateways({
          kiln: {
            release: () => Promise.resolve(failure("kiln", "PROVIDER_TIMEOUT")),
          },
          nori: {
            hold: () => Promise.resolve(failure("nori", "SLOT_UNAVAILABLE")),
          },
        }),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      compensationComplete: false,
      error: { code: "COMPENSATION_INCOMPLETE" },
    });
  });

  it("releases every hold when authoritative workflow persistence fails", async () => {
    const session = await fixture();
    const releases = {
      kiln: vi.fn<ProviderGateway["release"]>(),
      nori: vi.fn<ProviderGateway["release"]>(),
      loop: vi.fn<ProviderGateway["release"]>(),
    };
    for (const provider of ["kiln", "nori", "loop"] as const) {
      releases[provider].mockImplementation((input) =>
        Promise.resolve(
          success<ProviderReleaseData>(provider, {
            capacityRestored: true,
            holdSafeReference: input.holdSafeReference,
            provider,
            slotId: session.candidates[0]!.items.find(
              (item) => item.slot.provider === provider,
            )!.slot.slotId,
            status: "RELEASED",
          }),
        ),
      );
    }
    const result = await holdSelectedBundle(
      {
        browserSessionId,
        bundleId: session.selectedBundleId,
        bundleSession: session,
        bundleVersion: 1,
      },
      {
        bundleHoldId: () => "60000000-0000-4000-8000-000000000001",
        clientRequestId: (provider) => safeReferences[provider],
        gateways: gateways({
          kiln: { release: releases.kiln },
          nori: { release: releases.nori },
          loop: { release: releases.loop },
        }),
        persistHeld: () => Promise.reject(new Error("database unavailable")),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      compensationComplete: true,
      error: { code: "INTERNAL_ERROR" },
    });
    for (const provider of ["kiln", "nori", "loop"] as const) {
      expect(releases[provider]).toHaveBeenCalledOnce();
    }
  });
});
