import { describe, expect, it } from "vitest";

import type { PlannerIntentV2 } from "@serendipity/contracts/planner-v2";
import { SHIBUYA_ACTIVE_PACK_V2 } from "../../../apps/hub/data/shibuya-v2";

import {
  composeEveningPlan,
  createCandidateSetIdV2,
  estimateCoordinateTravelV2,
  swapEveningPlanStop,
} from "./planner-v2";

const canonicalIntent: PlannerIntentV2 = {
  schemaVersion: "2",
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-29T17:00:00+09:00",
  endAt: "2026-08-29T22:00:00+09:00",
  totalBudgetYen: 5000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: ["art", "books", "quiet"],
  excludedTags: ["alcohol", "smoking"],
};

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
        composeEveningPlan({
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
    expect(result.plan.planId).toMatch(/^plan-[a-f0-9]{24}$/);
    expect(result.plan.candidateSetId).toBe(
      await createCandidateSetIdV2(canonicalIntent, SHIBUYA_ACTIVE_PACK_V2),
    );
  });

  it("PV2-BE-003 falls back to two stops only when three cannot fit", async () => {
    const result = await composeEveningPlan({
      intent: {
        ...canonicalIntent,
        endAt: "2026-08-29T19:00:00+09:00",
      },
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.stops).toHaveLength(2);
  });

  it("PV2-BE-004 enforces exclusions and avoids gym-pool filler routes", async () => {
    const result = await composeEveningPlan({
      intent: {
        ...canonicalIntent,
        excludedTags: ["outdoors", "quiet"],
      },
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
    });
    expect(result).toEqual({ ok: false, code: "NO_VALID_PLAN" });

    const noPreferences = await composeEveningPlan({
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
      await composeEveningPlan({
        intent: { ...canonicalIntent, preferredTags: ["music"] },
        dataPack: SHIBUYA_ACTIVE_PACK_V2,
      }),
    ).toEqual({ ok: false, code: "NO_VALID_PLAN" });
  });

  it("PV2-BE-005 warns after 14 days and excludes after 60 days", async () => {
    const warningPack = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    const gallery = warningPack.places.find(
      ({ placeId }) => placeId === "kawamoto-puppet-gallery",
    );
    expect(gallery).toBeTruthy();
    if (!gallery) return;
    gallery.evidence.hours.checkedAt = "2026-08-01T12:00:00+09:00";
    gallery.evidence.price.checkedAt = "2026-08-01T12:00:00+09:00";
    const warning = await composeEveningPlan({
      intent: canonicalIntent,
      dataPack: warningPack,
      asOf: new Date("2026-08-29T13:50:00Z"),
    });
    expect(warning.ok).toBe(true);
    if (warning.ok) {
      expect(warning.warnings).toContain(
        "SOURCE_RECHECK_RECOMMENDED:kawamoto-puppet-gallery",
      );
    }

    const expiredPack = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    for (const place of expiredPack.places) {
      place.evidence.hours.checkedAt = "2026-06-01T12:00:00+09:00";
      place.evidence.price.checkedAt = "2026-06-01T12:00:00+09:00";
    }
    expect(
      await composeEveningPlan({
        intent: canonicalIntent,
        dataPack: expiredPack,
        asOf: new Date("2026-08-29T13:50:00Z"),
      }),
    ).toEqual({ ok: false, code: "NO_VALID_PLAN" });
  });

  it("PV2-BE-006 rejects a tampered stateless swap snapshot", async () => {
    const initial = await composeEveningPlan({
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
      await swapEveningPlanStop({
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
      place.coordinates.latitude += index * 0.000001;
      return place;
    });

    await composeEveningPlan({ intent: canonicalIntent, dataPack: densePack });
    const durations: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now();
      await composeEveningPlan({
        intent: canonicalIntent,
        dataPack: densePack,
      });
      durations.push(performance.now() - startedAt);
    }
    durations.sort((left, right) => left - right);
    expect(durations[18]).toBeLessThanOrEqual(100);
  });
});
