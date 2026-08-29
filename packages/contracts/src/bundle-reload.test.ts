import { describe, expect, it } from "vitest";

import { contractValidators } from "./index";

const bundle = {
  bundleId: "bundle-safe",
  bundleVersion: 1,
  items: ["kiln", "nori", "loop"].map((provider, index) => ({
    position: index,
    slot: {
      slotId: `${provider}.slot`,
      provider,
      title: `${provider} title`,
      category:
        provider === "kiln"
          ? "workshop"
          : provider === "nori"
            ? "food"
            : "culture",
      startsAt: `2030-05-17T${18 + index}:00:00+09:00`,
      endsAt: `2030-05-17T${18 + index}:30:00+09:00`,
      priceYen: 1000,
      originalPriceYen: 1200,
      capacityRemaining: 1,
      location: {
        locationId: `${provider}.location`,
        name: `${provider} place`,
        addressShort: "Shibuya",
        mapX: 20 + index * 20,
        mapY: 30 + index * 10,
      },
      tags: ["creative"],
      noveltyScore: 0.8,
      inventoryVersion: "1",
    },
    travelFromPreviousMinutes: index === 0 ? 0 : 10,
    spareGapFromPreviousMinutes: index === 0 ? 0 : 20,
  })),
  startsAt: "2030-05-17T18:00:00+09:00",
  endsAt: "2030-05-17T20:30:00+09:00",
  totalPriceYen: 3000,
  totalTravelMinutes: 20,
  score: 10,
  scoreBreakdown: {
    preferenceFit: 0.8,
    novelty: 0.8,
    timeUtilization: 0.8,
    discount: 0.1,
    travelBurden: 0.2,
  },
  reasonCodes: ["MATCHES_PREFERENCES"],
} as const;

describe("bundle reload public data", () => {
  it("accepts the existing authoritative three-Provider reload shape", () => {
    expect(
      contractValidators.bundleReloadData({
        bundle,
        bundleHoldId: "hold-safe",
        bundleSessionId: "session-safe",
        expiresAt: "2030-05-17T18:01:30+09:00",
        ok: true,
        phase: "held",
        providerStates: ["kiln", "nori", "loop"].map((provider, index) => ({
          holdSafeReference: `safe-${index}`,
          provider,
          status: "HELD",
        })),
        requiresFreshSearch: false,
      }),
    ).toBe(true);
  });

  it("rejects missing Providers, private fields, and contradictory terminal data", () => {
    const base = {
      bundle,
      bundleHoldId: "hold-safe",
      bundleSessionId: "session-safe",
      expiresAt: null,
      ok: true,
      phase: "released",
      providerStates: ["kiln", "nori", "loop"].map((provider, index) => ({
        holdSafeReference: `safe-${index}`,
        provider,
        status: "RELEASED",
      })),
      requiresFreshSearch: true,
    };

    expect(
      contractValidators.bundleReloadData({
        ...base,
        providerStates: base.providerStates.slice(0, 2),
      }),
    ).toBe(false);
    expect(
      contractValidators.bundleReloadData({ ...base, holdToken: "secret" }),
    ).toBe(false);
  });
});
