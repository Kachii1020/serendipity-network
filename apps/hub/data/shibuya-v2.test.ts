import { describe, expect, it } from "vitest";

import {
  type PlannerIntentV2,
  validatePlaceDataPackV2,
} from "@serendipity/contracts/planner-v2";
import {
  composeEveningPlan,
  swapEveningPlanStop,
} from "@serendipity/bundle-engine/planner-v2";

import {
  getPlaceEvidenceV2,
  getShibuyaPlaceSamplesV2,
  SHIBUYA_ACTIVE_PACK_V2,
} from "./shibuya-v2";

const canonicalIntentV2: PlannerIntentV2 = {
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

describe("Shibuya planner v2 data pack", () => {
  it("PV2-DATA-001 is an ACTIVE, rights-declared 9+ place pack", () => {
    expect(validatePlaceDataPackV2(SHIBUYA_ACTIVE_PACK_V2).ok).toBe(true);
    expect(SHIBUYA_ACTIVE_PACK_V2.status).toBe("ACTIVE");
    expect(SHIBUYA_ACTIVE_PACK_V2.places.length).toBeGreaterThanOrEqual(9);
    expect(
      new Set(SHIBUYA_ACTIVE_PACK_V2.places.map(({ category }) => category))
        .size,
    ).toBeGreaterThanOrEqual(3);
    expect(
      SHIBUYA_ACTIVE_PACK_V2.sources.some(
        ({ usage }) => usage.mode === "OFFICIAL_LINK_ONLY",
      ),
    ).toBe(false);
  });

  it("PV2-DATA-001b fails closed on stale or link-only factual evidence", () => {
    const stale = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    stale.sources[0]!.checkedAt = "2026-08-01T12:00:00+09:00";
    expect(validatePlaceDataPackV2(stale).ok).toBe(false);

    const linkOnly = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    linkOnly.sources[0]!.usage = { mode: "OFFICIAL_LINK_ONLY" };
    expect(validatePlaceDataPackV2(linkOnly).ok).toBe(false);
  });

  it("PV2-DATA-002 returns only the selected place's evidence sources", () => {
    const evidence = getPlaceEvidenceV2("kyu-asakura-house");
    expect(evidence?.placeName).toBe("Former Asakura Residence");
    expect(evidence?.sources.map(({ sourceId }) => sourceId)).toEqual([
      "shibuya-city-asakura",
      "wikidata-asakura",
    ]);
    expect(evidence?.claims.price.value).toContain("¥500");
    expect(getPlaceEvidenceV2("missing-place")).toBeNull();
  });

  it("PV2-DATA-003 contains no images or live availability fields", () => {
    const serialized = JSON.stringify(SHIBUYA_ACTIVE_PACK_V2);
    expect(serialized).not.toMatch(/imageUrl|image_url|capacity|availability/i);
    expect(serialized).not.toContain("http://");
    expect(getShibuyaPlaceSamplesV2().map(({ placeId }) => placeId)).toEqual([
      "kawamoto-puppet-gallery",
      "komorebi-owada-library",
      "miyashita-park",
    ]);
  });

  it("PV2-DATA-004 composes a coherent sourced culture route", async () => {
    const result = await composeEveningPlan({
      intent: canonicalIntentV2,
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      asOf: new Date("2026-08-29T13:50:00Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.stops.map(({ place }) => place.placeId)).toEqual([
      "kawamoto-puppet-gallery",
      "komorebi-owada-library",
      "miyashita-park",
    ]);
    expect(result.plan.totals.maxPriceYen).toBe(0);
    expect(result.plan.stops).toHaveLength(3);
    expect(result.plan.stops.every((stop) => stop.travelLabel.length > 0)).toBe(
      true,
    );
  });

  it("PV2-DATA-005 supports a stateless repeatable single-stop swap", async () => {
    const initial = await composeEveningPlan({
      intent: canonicalIntentV2,
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
    });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const swapped = await swapEveningPlanStop({
      intent: canonicalIntentV2,
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      plan: initial.plan,
      stopIndex: 2,
      preference: "DIFFERENT_INTEREST",
    });
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    expect(swapped.plan.stops[0]?.place.placeId).toBe(
      initial.plan.stops[0]?.place.placeId,
    );
    expect(swapped.plan.stops[1]?.place.placeId).toBe(
      initial.plan.stops[1]?.place.placeId,
    );
    expect(swapped.plan.stops[2]?.place.placeId).not.toBe(
      initial.plan.stops[2]?.place.placeId,
    );
  });

  it.each([
    [
      "weekday afternoon",
      "2026-09-01T13:00:00+09:00",
      "2026-09-01T18:00:00+09:00",
    ],
    [
      "weekday evening",
      "2026-09-01T17:00:00+09:00",
      "2026-09-01T22:00:00+09:00",
    ],
    [
      "weekend evening",
      "2026-08-30T17:00:00+09:00",
      "2026-08-30T22:00:00+09:00",
    ],
  ])(
    "PV2-DATA-006 composes the %s promotion fixture",
    async (_label, startAt, endAt) => {
      const result = await composeEveningPlan({
        intent: { ...canonicalIntentV2, startAt, endAt },
        dataPack: SHIBUYA_ACTIVE_PACK_V2,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.stops).toHaveLength(3);
    },
  );
});
