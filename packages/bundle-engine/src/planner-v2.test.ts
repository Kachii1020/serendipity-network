import { describe, expect, it } from "vitest";

import {
  createReviewedPackClaimsV2,
  type PlaceDataPackV2,
  type PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";
import { SHIBUYA_ACTIVE_PACK_V2 } from "../../../apps/hub/data/shibuya-v2";
import reviewedClaimLedger from "../../../apps/hub/data/shibuya-v2.reviewed-claims.json";

import {
  composeEveningPlan,
  createCandidateSetIdV2,
  estimateCoordinateTravelV2,
  swapEveningPlanStop,
  validateActivePlanningDataPackV2,
} from "./planner-v2";

const canonicalIntent: PlannerIntentV2 = {
  schemaVersion: "2",
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-30T13:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  totalBudgetYen: 8000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: ["art", "hands-on", "lively", "quiet"],
  excludedTags: ["alcohol", "smoking"],
};

const TEST_NOW = new Date("2026-08-30T12:00:00+09:00");
const reviewFor = (pack: PlaceDataPackV2) => ({
  [pack.packVersion]: createReviewedPackClaimsV2(pack),
});
type ComposeInput = Omit<
  Parameters<typeof composeEveningPlan>[0],
  "reviewedClaims"
> & { reviewedClaims?: unknown };
type SwapInput = Omit<
  Parameters<typeof swapEveningPlanStop>[0],
  "reviewedClaims"
> & { reviewedClaims?: unknown };
const compose = (input: ComposeInput) =>
  composeEveningPlan({
    asOf: TEST_NOW,
    reviewedClaims: reviewFor(input.dataPack),
    ...input,
  });
const swap = (input: SwapInput) =>
  swapEveningPlanStop({
    asOf: TEST_NOW,
    reviewedClaims: reviewFor(input.dataPack),
    ...input,
  });

describe("planner v2 bundle engine", () => {
  it("PV2-BE-001 derives conservative 5-minute coordinate estimates", () => {
    const estimate = estimateCoordinateTravelV2(
      SHIBUYA_ACTIVE_PACK_V2.station.coordinates,
      SHIBUYA_ACTIVE_PACK_V2.places[0]?.coordinates ??
        SHIBUYA_ACTIVE_PACK_V2.station.coordinates,
    );
    expect(estimate.distanceMeters).toBeGreaterThan(0);
    expect(estimate.minutes % 5).toBe(0);
  });

  it("PV2-BE-002 composes byte-stable IDs and one selected plan", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        compose({
          intent: canonicalIntent,
          dataPack: SHIBUYA_ACTIVE_PACK_V2,
        }),
      ),
    );
    expect(new Set(results.map((result) => JSON.stringify(result))).size).toBe(
      1,
    );
    const result = results[0];
    expect(result?.ok).toBe(true);
    if (!result?.ok) return;
    expect(result.plan.stops).toHaveLength(3);
    expect(
      result.plan.stops.every((stop) => {
        const place = SHIBUYA_ACTIVE_PACK_V2.places.find(
          ({ placeId }) => placeId === stop.place.placeId,
        );
        return (
          place?.routeEligibility.kind === "ROUTABLE" &&
          place.hoursProvenance.kind === "PUBLISHED_WINDOWS" &&
          JSON.stringify(stop.priceProvenance) ===
            JSON.stringify(place.priceProvenance)
        );
      }),
    ).toBe(true);
    expect(result.plan.planId).toMatch(/^plan-[a-f0-9]{24}$/);
    expect(result.plan.candidateSetId).toBe(
      await createCandidateSetIdV2(canonicalIntent, SHIBUYA_ACTIVE_PACK_V2),
    );
  });

  it("PV2-BE-003 falls back to two stops only when three cannot fit", async () => {
    const result = await compose({
      intent: {
        ...canonicalIntent,
        startAt: "2026-08-30T17:00:00+09:00",
        endAt: "2026-08-30T19:00:00+09:00",
      },
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.stops).toHaveLength(2);
  });

  it("PV2-BE-004 enforces exclusions and avoids gym-pool filler routes", async () => {
    const result = await compose({
      intent: {
        ...canonicalIntent,
        excludedTags: ["outdoors", "quiet"],
      },
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
    });
    expect(result).toEqual({ ok: false, code: "NO_VALID_PLAN" });

    const noPreferences = await compose({
      intent: { ...canonicalIntent, preferredTags: [] },
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
    });
    expect(noPreferences.ok).toBe(true);
    if (!noPreferences.ok) return;
    const categories = noPreferences.plan.stops.map(
      ({ place }) => place.category,
    );
    expect(categories.includes("fitness") && categories.includes("pool")).toBe(
      false,
    );

    expect(
      await compose({
        intent: { ...canonicalIntent, preferredTags: ["music"] },
        dataPack: SHIBUYA_ACTIVE_PACK_V2,
      }),
    ).toEqual({ ok: false, code: "NO_VALID_PLAN" });
  });

  it("PV2-BE-005 rejects source-age tampering before composition", async () => {
    const warningPack = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    const gallery = warningPack.places.find(
      ({ placeId }) => placeId === "kawamoto-puppet-gallery",
    );
    expect(gallery).toBeTruthy();
    if (!gallery) return;
    gallery.evidence.hours.checkedAt = "2026-08-01T12:00:00+09:00";
    gallery.evidence.price.checkedAt = "2026-08-01T12:00:00+09:00";
    expect(
      await compose({
        intent: canonicalIntent,
        dataPack: warningPack,
        asOf: new Date("2026-08-29T13:50:00Z"),
      }),
    ).toEqual({ ok: false, code: "STALE_DATA_PACK" });

    const expiredPack = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    for (const place of expiredPack.places) {
      place.evidence.hours.checkedAt = "2026-06-01T12:00:00+09:00";
      place.evidence.price.checkedAt = "2026-06-01T12:00:00+09:00";
    }
    expect(
      await compose({
        intent: canonicalIntent,
        dataPack: expiredPack,
        asOf: new Date("2026-08-29T13:50:00Z"),
      }),
    ).toEqual({ ok: false, code: "STALE_DATA_PACK" });
  });

  it("PV2-BE-005b fails closed beyond the audited pack horizon", async () => {
    const result = await compose({
      intent: {
        ...canonicalIntent,
        startAt: "2026-10-29T17:00:00+09:00",
        endAt: "2026-10-29T22:00:00+09:00",
      },
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      asOf: new Date("2026-10-22T12:00:00+09:00"),
    });
    expect(result).toEqual({ ok: false, code: "STALE_DATA_PACK" });
  });

  it("PV2-BE-005c exports ACTIVE, schema, and as-of pack gating", () => {
    expect(
      validateActivePlanningDataPackV2(
        SHIBUYA_ACTIVE_PACK_V2,
        reviewedClaimLedger,
        new Date("2026-08-30T12:00:00+09:00"),
        canonicalIntent,
      ).ok,
    ).toBe(true);

    const candidate = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    candidate.status = "CANDIDATE";
    expect(
      validateActivePlanningDataPackV2(
        candidate,
        reviewFor(candidate),
        new Date("2026-08-30T12:00:00+09:00"),
      ),
    ).toMatchObject({ ok: false, reason: "INACTIVE_DATA_PACK" });

    const invalid = structuredClone(SHIBUYA_ACTIVE_PACK_V2) as unknown as {
      places: Array<{ evidence: { publicAccess?: unknown } }>;
    };
    delete invalid.places[0]?.evidence.publicAccess;
    expect(
      validateActivePlanningDataPackV2(
        invalid,
        reviewedClaimLedger,
        new Date("2026-08-30T12:00:00+09:00"),
      ),
    ).toMatchObject({ ok: false, reason: "INVALID_DATA_PACK" });

    expect(
      validateActivePlanningDataPackV2(
        SHIBUYA_ACTIVE_PACK_V2,
        reviewedClaimLedger,
        new Date("2026-10-29T00:00:00+09:00"),
      ),
    ).toMatchObject({ ok: false, reason: "EXPIRED_DATA_PACK" });
  });

  it("PV2-BE-005d refuses to compose an already-started same-day plan", async () => {
    await expect(
      composeEveningPlan({
        asOf: new Date("2026-08-30T20:00:00+09:00"),
        dataPack: SHIBUYA_ACTIVE_PACK_V2,
        intent: {
          ...canonicalIntent,
          endAt: "2026-08-30T19:30:00+09:00",
          startAt: "2026-08-30T17:00:00+09:00",
        },
        reviewedClaims: reviewedClaimLedger,
      }),
    ).resolves.toEqual({ ok: false, code: "NO_VALID_PLAN" });
  });

  it("PV2-BE-005e keeps end-of-horizon sources with an explicit recheck warning", async () => {
    const result = await composeEveningPlan({
      asOf: new Date("2026-10-28T12:00:00+09:00"),
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      intent: {
        ...canonicalIntent,
        startAt: "2026-10-28T13:00:00+09:00",
        endAt: "2026-10-28T22:00:00+09:00",
      },
      reviewedClaims: reviewedClaimLedger,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(
      result.warnings.every((warning) =>
        warning.startsWith("SOURCE_RECHECK_RECOMMENDED:"),
      ),
    ).toBe(true);
  });

  it("PV2-BE-006 rejects a tampered stateless swap snapshot", async () => {
    const initial = await compose({
      intent: canonicalIntent,
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
    });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const tampered = structuredClone(initial.plan);
    const first = tampered.stops[0];
    expect(first).toBeTruthy();
    if (!first) return;
    first.place.summary = "Tampered client summary";
    expect(
      await swap({
        intent: canonicalIntent,
        dataPack: SHIBUYA_ACTIVE_PACK_V2,
        plan: tampered,
        stopIndex: 2,
        preference: "DIFFERENT_INTEREST",
      }),
    ).toEqual({ ok: false, code: "STALE_PLAN" });
  });

  it("PV2-BE-007 keeps 30-place composition p95 below 100ms", async () => {
    const densePack = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    const basePlaces = [...densePack.places];
    densePack.places = Array.from({ length: 30 }, (_, index) => {
      const place = structuredClone(
        basePlaces[index % basePlaces.length] ?? basePlaces[0]!,
      );
      place.placeId = `${place.placeId}-${index}`;
      place.name = `${place.name} ${index}`;
      if (place.coordinates) {
        place.coordinates.latitude += index * 0.000001;
      }
      return place;
    });

    await compose({ intent: canonicalIntent, dataPack: densePack });
    const durations: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now();
      await compose({
        intent: canonicalIntent,
        dataPack: densePack,
      });
      durations.push(performance.now() - startedAt);
    }
    durations.sort((left, right) => left - right);
    expect(durations[18]).toBeLessThanOrEqual(100);
  });

  it("PV2-BE-008 requires ten minutes of published closing headroom", async () => {
    const pack = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    for (const place of pack.places) {
      if (
        !["kawamoto-puppet-gallery", "shibuya-botanical-center"].includes(
          place.placeId,
        )
      ) {
        place.weeklyHours = [{ days: [0], opens: "10:00", closes: "11:00" }];
      }
    }
    const gallery = pack.places.find(
      ({ placeId }) => placeId === "kawamoto-puppet-gallery",
    );
    const botanical = pack.places.find(
      ({ placeId }) => placeId === "shibuya-botanical-center",
    );
    expect(gallery && botanical).toBeTruthy();
    if (!gallery?.coordinates || !botanical?.coordinates) return;

    const intent: PlannerIntentV2 = {
      ...canonicalIntent,
      preferredTags: ["quiet"],
    };
    const firstTravel = estimateCoordinateTravelV2(
      pack.station.coordinates,
      gallery.coordinates,
    ).minutes;
    const exactEnd =
      Date.parse(intent.startAt) +
      (firstTravel + gallery.recommendedVisitMinutes) * 60_000;
    const localTime = (value: number): string =>
      new Date(value + 9 * 60 * 60_000).toISOString().slice(11, 16);
    gallery.weeklyHours = [
      {
        days: [0, 1, 2, 3, 4, 5, 6],
        opens: "12:00",
        closes: localTime(exactEnd),
      },
    ];
    botanical.weeklyHours = [
      { days: [0, 1, 2, 3, 4, 5, 6], opens: "12:00", closes: "23:00" },
    ];

    expect(await compose({ intent, dataPack: pack })).toEqual({
      ok: false,
      code: "NO_VALID_PLAN",
    });

    gallery.weeklyHours[0]!.closes = localTime(exactEnd + 10 * 60_000);
    const buffered = await compose({ intent, dataPack: pack });
    expect(buffered.ok).toBe(true);
    if (!buffered.ok) return;
    expect(buffered.plan.stops[0]?.openingFit).toContain(
      "10 minutes before closing",
    );
  });
});
