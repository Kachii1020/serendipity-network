import { describe, expect, it } from "vitest";

import {
  canExposeAreaDataPack,
  contractValidators,
  evaluateAreaPackPromotion,
  type AreaDataPack,
  validateAreaDataPack,
} from "./index";

const shinjukuCandidatePack = {
  schemaVersion: "1",
  packVersion: "1.0.0",
  area: {
    slug: "shinjuku",
    displayName: "Shinjuku",
    timezone: "Asia/Tokyo",
    currency: "JPY",
    localizedBoundaryCopy:
      "Shinjuku is a candidate network and is not available yet.",
  },
  status: "CANDIDATE",
  providers: [
    {
      provider: "kiln",
      origin: "https://kiln-shinjuku.example.test",
      slots: [
        {
          slotId: "shinjuku.kiln.workshop",
          provider: "kiln",
          title: "Pocket print workshop",
          category: "workshop",
          startsAt: "2030-05-17T18:15:00+09:00",
          endsAt: "2030-05-17T19:15:00+09:00",
          priceYen: 1500,
          originalPriceYen: 2200,
          capacityRemaining: 2,
          location: {
            locationId: "shinjuku.kiln",
            name: "Candidate Kiln",
            addressShort: "Shinjuku",
            mapX: 15,
            mapY: 20,
          },
          tags: ["creative", "hands-on"],
          noveltyScore: 0.8,
          inventoryVersion: "1",
        },
      ],
    },
    {
      provider: "nori",
      origin: "https://nori-shinjuku.example.test",
      slots: [
        {
          slotId: "shinjuku.nori.counter",
          provider: "nori",
          title: "Candidate counter tasting",
          category: "food",
          startsAt: "2030-05-17T19:35:00+09:00",
          endsAt: "2030-05-17T20:25:00+09:00",
          priceYen: 1800,
          originalPriceYen: 2600,
          capacityRemaining: 2,
          location: {
            locationId: "shinjuku.nori",
            name: "Candidate Nori",
            addressShort: "Shinjuku",
            mapX: 50,
            mapY: 48,
          },
          tags: ["seasonal", "food"],
          noveltyScore: 0.75,
          inventoryVersion: "1",
        },
      ],
    },
    {
      provider: "loop",
      origin: "https://loop-shinjuku.example.test",
      slots: [
        {
          slotId: "shinjuku.loop.listening",
          provider: "loop",
          title: "Candidate listening room",
          category: "culture",
          startsAt: "2030-05-17T20:45:00+09:00",
          endsAt: "2030-05-17T21:45:00+09:00",
          priceYen: 1200,
          originalPriceYen: 1900,
          capacityRemaining: 2,
          location: {
            locationId: "shinjuku.loop",
            name: "Candidate Loop",
            addressShort: "Shinjuku",
            mapX: 82,
            mapY: 72,
          },
          tags: ["experimental", "music"],
          noveltyScore: 0.9,
          inventoryVersion: "1",
        },
      ],
    },
  ],
  directedTravelMinutes: [
    {
      fromLocationId: "shinjuku.kiln",
      toLocationId: "shinjuku.nori",
      minutes: 15,
    },
    {
      fromLocationId: "shinjuku.kiln",
      toLocationId: "shinjuku.loop",
      minutes: 25,
    },
    {
      fromLocationId: "shinjuku.nori",
      toLocationId: "shinjuku.kiln",
      minutes: 15,
    },
    {
      fromLocationId: "shinjuku.nori",
      toLocationId: "shinjuku.loop",
      minutes: 15,
    },
    {
      fromLocationId: "shinjuku.loop",
      toLocationId: "shinjuku.kiln",
      minutes: 25,
    },
    {
      fromLocationId: "shinjuku.loop",
      toLocationId: "shinjuku.nori",
      minutes: 15,
    },
  ],
  serviceWindow: {
    startsAt: "2030-05-17T18:00:00+09:00",
    endsAt: "2030-05-17T22:30:00+09:00",
    totalBudgetYen: 5000,
    partySize: 1,
  },
  fixtureSlotIds: [
    "shinjuku.kiln.workshop",
    "shinjuku.nori.counter",
    "shinjuku.loop.listening",
  ],
} as const satisfies AreaDataPack;

const cloneCandidatePack = (): AreaDataPack =>
  structuredClone(shinjukuCandidatePack);

const expectRejectedWithIssue = (
  pack: unknown,
  expectedIssue: string,
): void => {
  const result = validateAreaDataPack(pack);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected area pack validation to fail");
  expect(result.issues.some((issue) => issue.includes(expectedIssue))).toBe(
    true,
  );
};

const passedGates = {
  protectedReset: true,
  reliability: true,
  productionE2E: true,
} as const;

describe("area data-pack contract", () => {
  it("IMP-005 rejects missing or incomplete candidate packs", () => {
    const missingProvider = cloneCandidatePack();
    missingProvider.providers.pop();

    const incompleteTravel = cloneCandidatePack();
    incompleteTravel.directedTravelMinutes.pop();

    expect(validateAreaDataPack(missingProvider).ok).toBe(false);
    expectRejectedWithIssue(incompleteTravel, "is missing");
  });

  it("IMP-006 accepts a complete exact-origin candidate pack", () => {
    expect(contractValidators.areaDataPack(shinjukuCandidatePack)).toBe(true);
    expect(validateAreaDataPack(shinjukuCandidatePack)).toEqual({
      ok: true,
      value: shinjukuCandidatePack,
    });
  });

  it.each([
    "https://*.example.test",
    "http://kiln-shinjuku.example.test",
    "https://kiln-shinjuku.example.test/path",
  ])("IMP-006 rejects invalid or wildcard origin %s", (origin) => {
    const pack = cloneCandidatePack();
    pack.providers[0]!.origin = origin;
    expect(validateAreaDataPack(pack).ok).toBe(false);
  });

  it("IMP-006 rejects Provider mismatches and duplicate slot IDs", () => {
    const mismatch = cloneCandidatePack();
    mismatch.providers[0]!.slots[0]!.provider = "nori";

    const duplicateSlotId = cloneCandidatePack();
    duplicateSlotId.providers[1]!.slots[0]!.slotId =
      duplicateSlotId.providers[0]!.slots[0]!.slotId;

    expectRejectedWithIssue(mismatch, "must match its Provider pack entry");
    expectRejectedWithIssue(duplicateSlotId, "slotId must be unique");
  });

  it("IMP-006 requires one unique origin for each exact Provider identity", () => {
    const duplicateProvider = cloneCandidatePack();
    duplicateProvider.providers[1]!.provider = "kiln";

    const duplicateOrigin = cloneCandidatePack();
    duplicateOrigin.providers[1]!.origin = duplicateOrigin.providers[0]!.origin;

    expectRejectedWithIssue(duplicateProvider, "provider must be unique");
    expectRejectedWithIssue(duplicateOrigin, "origin must be unique");
  });

  it("IMP-006 rejects missing, duplicate, and extra travel edges", () => {
    const missing = cloneCandidatePack();
    missing.directedTravelMinutes.pop();

    const duplicate = cloneCandidatePack();
    duplicate.directedTravelMinutes.push({
      ...duplicate.directedTravelMinutes[0]!,
    });

    const extra = cloneCandidatePack();
    extra.directedTravelMinutes.push({
      fromLocationId: "shinjuku.kiln",
      toLocationId: "shinjuku.kiln",
      minutes: 0,
    });

    expect(validateAreaDataPack(missing).ok).toBe(false);
    expectRejectedWithIssue(duplicate, "duplicates");
    expectRejectedWithIssue(extra, "extra edge");
  });

  it("IMP-006 rejects an infeasible or absent three-Provider route", () => {
    const infeasible = cloneCandidatePack();
    infeasible.providers[2]!.slots[0]!.startsAt = "2030-05-17T20:30:00+09:00";

    const unavailable = cloneCandidatePack();
    unavailable.providers[1]!.slots[0]!.capacityRemaining = 0;

    expectRejectedWithIssue(infeasible, "feasible three-Provider route");
    expectRejectedWithIssue(unavailable, "complete feasible three-Provider");
  });

  it("IMP-007 keeps a valid non-Shibuya candidate dark until explicit promotion", () => {
    expect(
      evaluateAreaPackPromotion(shinjukuCandidatePack, {
        protectedReset: true,
        reliability: false,
        productionE2E: false,
      }),
    ).toEqual({
      eligible: false,
      issues: [
        "/promotion/reliability must pass",
        "/promotion/productionE2E must pass",
      ],
    });
    expect(
      evaluateAreaPackPromotion(shinjukuCandidatePack, passedGates),
    ).toEqual({ eligible: true, issues: [] });

    expect(canExposeAreaDataPack(shinjukuCandidatePack, passedGates)).toBe(
      false,
    );

    const improperlyActivated = {
      ...shinjukuCandidatePack,
      status: "ACTIVE",
    } as const;
    expect(contractValidators.areaDataPack(improperlyActivated)).toBe(true);
    expect(validateAreaDataPack(improperlyActivated).ok).toBe(false);
  });

  it("IMP-007 exposes only an ACTIVE allowlisted pack with every gate passed", () => {
    const shibuyaActive = {
      ...shinjukuCandidatePack,
      area: {
        ...shinjukuCandidatePack.area,
        slug: "shibuya",
        displayName: "Shibuya",
      },
      status: "ACTIVE",
    } as const;

    expect(validateAreaDataPack(shibuyaActive).ok).toBe(true);
    expect(
      canExposeAreaDataPack(shibuyaActive, {
        ...passedGates,
        productionE2E: false,
      }),
    ).toBe(false);
    expect(canExposeAreaDataPack(shibuyaActive, passedGates)).toBe(true);
  });
});
