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
import reviewedClaimLedger from "./shibuya-v2.reviewed-claims.json";

const canonicalIntentV2: PlannerIntentV2 = {
  schemaVersion: "2",
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-30T13:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
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
    expect(
      SHIBUYA_ACTIVE_PACK_V2.places.filter(
        ({ routeEligibility }) => routeEligibility.kind === "ROUTABLE",
      ),
    ).toHaveLength(9);
  });

  it("PV2-DATA-001a exposes only fully sourced route-eligible places", () => {
    expect(
      SHIBUYA_ACTIVE_PACK_V2.places.every(
        ({
          coordinates,
          evidence,
          hoursProvenance,
          priceProvenance,
          routeEligibility,
        }) =>
          routeEligibility.kind === "ROUTABLE" &&
          hoursProvenance.kind === "PUBLISHED_WINDOWS" &&
          priceProvenance.kind === "PUBLISHED_AMOUNT" &&
          coordinates !== null &&
          evidence.coordinates !== null,
      ),
    ).toBe(true);
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
      "cabinet-office-holidays-2026",
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
      "shibuya-botanical-center",
      "yoyogi-library",
    ]);
  });

  it("PV2-DATA-003b every route price and coordinate has its own provenance", () => {
    for (const place of SHIBUYA_ACTIVE_PACK_V2.places) {
      expect(place.priceProvenance.kind).toBe("PUBLISHED_AMOUNT");
      expect(place.evidence.coordinates).not.toBeNull();
      const evidence = getPlaceEvidenceV2(place.placeId);
      expect(evidence?.claims.price.value).not.toContain("planner reference");
      expect(evidence?.claims.address.sourceUrl).toBeTruthy();
      expect(evidence?.claims.coordinates?.sourceUrl).toBeTruthy();
      expect(evidence?.claims.publicAccess.kind).toBe("PUBLIC_ACCESS");
      expect(evidence?.claims.publicAccess.value).toContain(
        "not live availability",
      );
    }
  });

  it("PV2-DATA-003c materializes every published closure through October 28", () => {
    const expectedClosedByPlace = new Map<string, readonly string[]>([
      [
        "kyu-asakura-house",
        [
          "2026-08-31",
          "2026-09-07",
          "2026-09-14",
          "2026-09-24",
          "2026-09-28",
          "2026-10-05",
          "2026-10-13",
          "2026-10-19",
          "2026-10-26",
        ],
      ],
      ["kawamoto-puppet-gallery", []],
      [
        "shibuya-botanical-center",
        [
          "2026-08-31",
          "2026-09-07",
          "2026-09-14",
          "2026-09-24",
          "2026-09-28",
          "2026-10-05",
          "2026-10-13",
          "2026-10-19",
          "2026-10-26",
        ],
      ],
      [
        "hachilabo-science-center",
        [
          "2026-08-31",
          "2026-09-07",
          "2026-09-14",
          "2026-09-24",
          "2026-09-28",
          "2026-10-05",
          "2026-10-13",
          "2026-10-19",
          "2026-10-26",
        ],
      ],
      [
        "shibuya-central-library",
        ["2026-09-07", "2026-09-17", "2026-10-05", "2026-10-15"],
      ],
      [
        "komorebi-owada-library",
        [
          "2026-09-08",
          "2026-09-10",
          "2026-09-14",
          "2026-09-24",
          "2026-09-28",
          "2026-10-06",
          "2026-10-08",
          "2026-10-13",
          "2026-10-20",
          "2026-10-26",
        ],
      ],
      [
        "tomigaya-library",
        [
          "2026-09-07",
          "2026-09-10",
          "2026-09-15",
          "2026-09-24",
          "2026-09-29",
          "2026-10-05",
          "2026-10-08",
          "2026-10-13",
          "2026-10-19",
          "2026-10-27",
        ],
      ],
      [
        "rinsen-minna-library",
        [
          "2026-09-08",
          "2026-09-10",
          "2026-09-14",
          "2026-09-24",
          "2026-09-28",
          "2026-10-06",
          "2026-10-08",
          "2026-10-13",
          "2026-10-20",
          "2026-10-26",
        ],
      ],
      [
        "yoyogi-library",
        [
          "2026-09-01",
          "2026-09-08",
          "2026-09-10",
          "2026-09-15",
          "2026-09-20",
          "2026-09-22",
          "2026-09-29",
          "2026-10-06",
          "2026-10-08",
          "2026-10-13",
          "2026-10-18",
          "2026-10-20",
          "2026-10-27",
        ],
      ],
    ]);
    const horizonDates: string[] = [];
    for (
      let cursor = Date.parse("2026-08-30T00:00:00Z");
      cursor <= Date.parse("2026-10-28T00:00:00Z");
      cursor += 86_400_000
    ) {
      horizonDates.push(new Date(cursor).toISOString().slice(0, 10));
    }

    for (const place of SHIBUYA_ACTIVE_PACK_V2.places) {
      const closedDates = horizonDates.filter((date) => {
        const exception = place.dateExceptions.find(
          (candidate) => candidate.date === date,
        );
        if (exception) return exception.closed;
        const weekday = new Date(`${date}T12:00:00+09:00`).getUTCDay();
        return !place.weeklyHours.some(({ days }) => days.includes(weekday));
      });
      expect(closedDates, place.placeId).toEqual(
        expectedClosedByPlace.get(place.placeId),
      );
    }
  });

  it("PV2-DATA-004 composes a coherent sourced culture route", async () => {
    const result = await composeEveningPlan({
      intent: canonicalIntentV2,
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      asOf: new Date("2026-08-30T12:00:00+09:00"),
      reviewedClaims: reviewedClaimLedger,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.stops).toHaveLength(3);
    expect(result.plan.totals.maxPriceYen).toBeLessThanOrEqual(5000);
    expect(
      result.plan.stops.every(({ place }) =>
        place.tags.some((tag) => canonicalIntentV2.preferredTags.includes(tag)),
      ),
    ).toBe(true);
    expect(result.plan.stops.every((stop) => stop.travelLabel.length > 0)).toBe(
      true,
    );
  });

  it("PV2-DATA-005 supports a stateless repeatable single-stop swap", async () => {
    const swapIntent: PlannerIntentV2 = {
      ...canonicalIntentV2,
      startAt: "2026-08-30T13:00:00+09:00",
      endAt: "2026-08-30T22:00:00+09:00",
      maxWalkMinutesPerLeg: 30,
      preferredTags: [],
    };
    const initial = await composeEveningPlan({
      asOf: new Date("2026-08-30T12:00:00+09:00"),
      intent: swapIntent,
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      reviewedClaims: reviewedClaimLedger,
    });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const swapped = await swapEveningPlanStop({
      asOf: new Date("2026-08-30T12:00:00+09:00"),
      intent: swapIntent,
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      plan: initial.plan,
      stopIndex: 0,
      preference: "DIFFERENT_INTEREST",
      reviewedClaims: reviewedClaimLedger,
    });
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    expect(swapped.plan.stops[1]?.place.placeId).toBe(
      initial.plan.stops[1]?.place.placeId,
    );
    expect(swapped.plan.stops).toHaveLength(3);
    expect(swapped.plan.stops[2]?.place.placeId).toBe(
      initial.plan.stops[2]?.place.placeId,
    );
    expect(swapped.plan.stops[0]?.place.placeId).not.toBe(
      initial.plan.stops[0]?.place.placeId,
    );
  });

  it("PV2-DATA-005b never pads a preferred-interest plan with unrelated stops", async () => {
    const result = await composeEveningPlan({
      asOf: new Date("2026-08-30T12:00:00+09:00"),
      intent: {
        ...canonicalIntentV2,
        maxWalkMinutesPerLeg: 10,
        preferredTags: ["hands-on"],
        totalBudgetYen: 3000,
      },
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      reviewedClaims: reviewedClaimLedger,
    });
    if (!result.ok) {
      expect(result).toEqual({ ok: false, code: "NO_VALID_PLAN" });
      return;
    }
    expect(
      result.plan.stops.every(({ place }) => place.tags.includes("hands-on")),
    ).toBe(true);
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
        asOf: new Date(Date.parse(startAt) - 5 * 60_000),
        intent: { ...canonicalIntentV2, startAt, endAt },
        dataPack: SHIBUYA_ACTIVE_PACK_V2,
        reviewedClaims: reviewedClaimLedger,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.plan.stops.length).toBeGreaterThanOrEqual(2);
      expect(result.plan.stops.length).toBeLessThanOrEqual(3);
    },
  );
});
