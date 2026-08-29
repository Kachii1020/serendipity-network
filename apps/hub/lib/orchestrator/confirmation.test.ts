import { composeBundles } from "@serendipity/bundle-engine";
import {
  type Provider,
  type ProviderConfirmData,
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
import type { HeldBundleSession } from "./hold";
import { confirmHeldBundle, releaseHeldBundle } from "./confirmation";

const browserSessionId = "20000000-0000-4000-8000-000000000001";
const references: Record<Provider, string> = {
  kiln: "30000000-0000-4000-8000-000000000001",
  nori: "30000000-0000-4000-8000-000000000002",
  loop: "30000000-0000-4000-8000-000000000003",
};

const meta = (provider: Provider): ProviderResultMeta => ({
  completedAt: "2030-05-17T09:00:00Z",
  correlationId: `confirmation-${provider}`,
  origin: `https://${provider}.test`,
});

const success = <T>(provider: Provider, data: T): ProviderGatewayResult<T> => ({
  data,
  meta: meta(provider),
  ok: true,
});

const timeout = (provider: Provider): ProviderGatewayResult<never> => ({
  error: {
    code: "PROVIDER_TIMEOUT",
    message: "Timed out.",
    provider,
    retryable: true,
  },
  failureType: "offline",
  ok: false,
});

const fixture = async (): Promise<HeldBundleSession> => {
  const composed = await composeBundles({
    bundleVersion: 1,
    intent: canonicalIntent,
    slotsByProvider: canonicalSlotsByProvider,
    travelTimes: canonicalTravelTimes,
  });
  if (!composed.ok || !composed.candidates[0]) {
    throw new Error("canonical candidate missing");
  }
  return {
    browserSessionId,
    bundle: composed.candidates[0],
    bundleHoldId: "60000000-0000-4000-8000-000000000001",
    bundleSessionId: "50000000-0000-4000-8000-000000000001",
    expiresAt: "2030-05-17T09:01:20Z",
    providerHolds: (["kiln", "nori", "loop"] as const).map((provider) => ({
      expiresAt: "2030-05-17T09:01:20Z",
      holdSafeReference: references[provider],
      provider,
      slotId: composed.candidates[0]!.items.find(
        (item) => item.slot.provider === provider,
      )!.slot.slotId,
    })),
  };
};

type Overrides = {
  confirm?: ProviderGateway["confirm"];
  release?: ProviderGateway["release"];
  status?: ProviderGateway["getHoldStatus"];
};

const gateway = (
  provider: Provider,
  overrides: Overrides = {},
): ProviderGateway => ({
  provider,
  search: () => Promise.reject(new Error("not used")),
  hold: () => Promise.reject(new Error("not used")),
  getHoldStatus:
    overrides.status ??
    ((input) =>
      Promise.resolve(
        success<ProviderHoldStatusData>(provider, {
          expiresAt: "2030-05-17T09:01:20Z",
          holdSafeReference: input.holdSafeReference!,
          provider,
          reservationRef: `reservation-${provider}`,
          slotId: canonicalSlotsByProvider[provider][0]!.slotId,
          status: "CONFIRMED",
        }),
      )),
  confirm:
    overrides.confirm ??
    ((input) =>
      Promise.resolve(
        success<ProviderConfirmData>(provider, {
          confirmedAt: "2030-05-17T09:00:10Z",
          holdSafeReference: input.holdSafeReference,
          provider,
          reservationRef: `reservation-${provider}`,
          status: "CONFIRMED",
        }),
      )),
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
  overrides: Partial<Record<Provider, Overrides>> = {},
): Record<Provider, ProviderGateway> => ({
  kiln: gateway("kiln", overrides.kiln),
  nori: gateway("nori", overrides.nori),
  loop: gateway("loop", overrides.loop),
});

describe("confirmation and release orchestration", () => {
  it("confirms all three Providers and returns one safe receipt", async () => {
    const held = await fixture();
    const result = await confirmHeldBundle(held, {
      gateways: gateways(),
      now: () => new Date("2030-05-17T09:00:20Z"),
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        bundleId: held.bundle.bundleId,
        status: "CONFIRMED",
        totalPriceYen: held.bundle.totalPriceYen,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/holdToken|idempotencyKey/i);
  });

  it("reconciles a lost confirm response from authoritative status", async () => {
    const held = await fixture();
    const status = vi.fn<ProviderGateway["getHoldStatus"]>((input) =>
      Promise.resolve(
        success<ProviderHoldStatusData>("loop", {
          expiresAt: held.expiresAt,
          holdSafeReference: input.holdSafeReference!,
          provider: "loop",
          reservationRef: "reservation-loop",
          slotId: held.providerHolds[2]!.slotId,
          status: "CONFIRMED",
        }),
      ),
    );
    const result = await confirmHeldBundle(held, {
      gateways: gateways({
        loop: { confirm: () => Promise.resolve(timeout("loop")), status },
      }),
      now: () => new Date("2030-05-17T09:00:20Z"),
    });

    expect(result.ok).toBe(true);
    expect(status).toHaveBeenCalledOnce();
  });

  it("reports mixed confirmed and held states without a false receipt", async () => {
    const held = await fixture();
    const result = await confirmHeldBundle(held, {
      gateways: gateways({
        loop: {
          confirm: () => Promise.resolve(timeout("loop")),
          status: (input) =>
            Promise.resolve(
              success<ProviderHoldStatusData>("loop", {
                expiresAt: held.expiresAt,
                holdSafeReference: input.holdSafeReference!,
                provider: "loop",
                slotId: held.providerHolds[2]!.slotId,
                status: "HELD",
              }),
            ),
        },
      }),
      now: () => new Date("2030-05-17T09:00:20Z"),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_INCONSISTENT" },
    });
  });

  it("checks expiry before confirmation and requires a fresh search", async () => {
    const held = await fixture();
    const confirm = vi.fn<ProviderGateway["confirm"]>();
    const result = await confirmHeldBundle(held, {
      gateways: gateways({ kiln: { confirm } }),
      now: () => new Date("2030-05-17T09:02:00Z"),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "HOLD_EXPIRED" },
      requiresFreshSearch: true,
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it("preflights release and refuses to claim rollback when one item is confirmed", async () => {
    const held = await fixture();
    const release = vi.fn<ProviderGateway["release"]>();
    const heldStatus =
      (provider: "kiln" | "loop") =>
      (input: Parameters<ProviderGateway["getHoldStatus"]>[0]) =>
        Promise.resolve(
          success<ProviderHoldStatusData>(provider, {
            expiresAt: held.expiresAt,
            holdSafeReference: input.holdSafeReference!,
            provider,
            slotId: held.providerHolds.find(
              (item) => item.provider === provider,
            )!.slotId,
            status: "HELD",
          }),
        );
    const result = await releaseHeldBundle(held, {
      gateways: gateways({
        kiln: { release, status: heldStatus("kiln") },
        nori: {
          status: (input) =>
            Promise.resolve(
              success<ProviderHoldStatusData>("nori", {
                expiresAt: held.expiresAt,
                holdSafeReference: input.holdSafeReference!,
                provider: "nori",
                reservationRef: "reservation-nori",
                slotId: held.providerHolds[1]!.slotId,
                status: "CONFIRMED",
              }),
            ),
        },
        loop: { status: heldStatus("loop") },
      }),
      now: () => new Date("2030-05-17T09:00:20Z"),
      reason: "USER_CANCELLED",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "ALREADY_CONFIRMED", provider: "nori" },
    });
    expect(release).not.toHaveBeenCalled();
  });

  it("releases all active holds with terminal Provider statuses", async () => {
    const held = await fixture();
    const heldStatus =
      (provider: Provider): ProviderGateway["getHoldStatus"] =>
      (input) =>
        Promise.resolve(
          success<ProviderHoldStatusData>(provider, {
            expiresAt: held.expiresAt,
            holdSafeReference: input.holdSafeReference!,
            provider,
            slotId: held.providerHolds.find(
              (item) => item.provider === provider,
            )!.slotId,
            status: "HELD",
          }),
        );
    const result = await releaseHeldBundle(held, {
      gateways: gateways({
        kiln: { status: heldStatus("kiln") },
        nori: { status: heldStatus("nori") },
        loop: { status: heldStatus("loop") },
      }),
      now: () => new Date("2030-05-17T09:00:20Z"),
      reason: "USER_CANCELLED",
    });

    expect(result).toMatchObject({
      ok: true,
      data: { bundleId: held.bundle.bundleId, status: "RELEASED" },
    });
  });
});
