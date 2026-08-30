import { describe, expect, it } from "vitest";

import {
  createReviewedPackClaimsV3,
  type AreaDataPackV3,
  type EveningPlanV3,
  type PlannerIntentV3,
} from "@serendipity/contracts/planner-v3";

import {
  composeEveningPlanV3,
  createCandidateSetIdV3,
  estimateCoordinateTravelV3,
  swapEveningPlanStopV3,
  validateActiveAreaDataPackV3,
} from "./planner-v3";

type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

const source = (
  sourceId: string,
  sourceKind: "OFFICIAL_SITE" | "OFFICIAL_MENU" = "OFFICIAL_SITE",
  factScope: Array<
    | "IDENTITY"
    | "ADDRESS"
    | "COORDINATES"
    | "HOURS"
    | "PRICE"
    | "PUBLIC_ACCESS"
    | "MENU"
  > = ["IDENTITY", "ADDRESS", "COORDINATES", "HOURS", "PRICE", "PUBLIC_ACCESS"],
) => ({
  sourceId,
  title: `${sourceId} source`,
  publisher: "Fixture publisher",
  sourceKind,
  url: `https://example.com/${sourceId}`,
  checkedAt: "2030-05-16T10:00:00+09:00",
  usage: {
    mode: "OFFICIAL_FACT_REFERENCE" as const,
    factScope,
    attribution: "Fixture publisher",
  },
});

const place = (
  index: number,
  role: "ACTIVITY" | "MEAL",
  options: {
    tags?: AreaDataPackV3["places"][number]["tags"];
    price?: AreaDataPackV3["places"][number]["price"];
    minutes?: number;
    latitude?: number;
  } = {},
): Mutable<AreaDataPackV3["places"][number]> => {
  const sourceId = `${role.toLowerCase()}-${index}`;
  const menuSourceId = `${sourceId}-menu`;
  const evidence = {
    sourceId,
    checkedAt: "2030-05-16T10:00:00+09:00",
  };
  return {
    placeId: `${sourceId}-place`,
    role,
    name: `${role} ${index}`,
    summary: `A source-backed ${role.toLowerCase()} fixture.`,
    category:
      role === "MEAL" ? "restaurant" : index % 2 === 0 ? "gallery" : "museum",
    address: `${index} Fixture Street, Tokyo`,
    coordinates: {
      latitude: options.latitude ?? 35.6909 + index * 0.0001,
      longitude: 139.7003 + index * 0.0001,
    },
    tags:
      options.tags ?? (role === "MEAL" ? ["food", "quiet"] : ["art", "quiet"]),
    officialUrl: `https://example.com/${sourceId}`,
    googlePlaceId: role === "MEAL" ? `ChIJfixture${index}` : null,
    recommendedVisitMinutes: options.minutes ?? (role === "MEAL" ? 60 : 45),
    weeklyHours: [
      { days: [0, 1, 2, 3, 4, 5, 6], opens: "12:00", closes: "23:00" },
    ],
    dateExceptions: [],
    price:
      options.price ??
      (role === "MEAL"
        ? {
            kind: "PER_PERSON",
            minYen: 1_500,
            maxYen: 2_000,
            label: "Published menu",
          }
        : { kind: "FREE", minYen: 0, maxYen: 0, label: "Free" }),
    evidence: {
      identity: evidence,
      address: evidence,
      coordinates: evidence,
      hours: evidence,
      price:
        role === "MEAL" ? { ...evidence, sourceId: menuSourceId } : evidence,
      publicAccess: evidence,
      officialLink: evidence,
      menu: role === "MEAL" ? { ...evidence, sourceId: menuSourceId } : null,
    },
  };
};

const createPack = (): Mutable<AreaDataPackV3> => {
  const places = [
    place(0, "ACTIVITY", { tags: ["art", "heritage"] }),
    place(1, "ACTIVITY", { tags: ["hands-on", "science"] }),
    place(2, "ACTIVITY", { tags: ["quiet", "books"] }),
    place(3, "ACTIVITY", { tags: ["lively", "music"] }),
    place(10, "MEAL", {
      tags: ["food", "quiet"],
      price: {
        kind: "PER_PERSON",
        minYen: 1_500,
        maxYen: 2_000,
        label: "Published menu",
      },
    }),
    place(11, "MEAL", {
      tags: ["food", "lively"],
      price: {
        kind: "PER_PERSON",
        minYen: 1_000,
        maxYen: 1_400,
        label: "Published menu",
      },
    }),
    place(12, "MEAL", {
      tags: ["food", "drinks"],
      price: {
        kind: "PER_PERSON",
        minYen: 2_500,
        maxYen: 3_000,
        label: "Published menu",
      },
    }),
  ];
  const sources = places.flatMap((candidate) => {
    const base = source(candidate.evidence.identity.sourceId);
    return candidate.role === "MEAL"
      ? [
          base,
          source(candidate.evidence.menu!.sourceId, "OFFICIAL_MENU", [
            "PRICE",
            "MENU",
          ]),
        ]
      : [base];
  });
  sources.push(source("station"));
  return {
    schemaVersion: "3",
    packVersion: "1.0.0",
    status: "ACTIVE",
    area: "shinjuku",
    generatedAt: "2030-05-17T00:00:00+09:00",
    validThrough: "2030-06-15T23:59:59+09:00",
    dataLicense: {
      licenseId: "MIXED-SEE-SOURCES",
      licenseUrl: "https://example.com/data-license",
      attribution: "See each source.",
    },
    station: {
      name: "Shinjuku Station",
      coordinates: { latitude: 35.6909, longitude: 139.7003 },
      sourceIds: ["station"],
    },
    sources,
    places,
  };
};

const intent: PlannerIntentV3 = {
  schemaVersion: "3",
  area: "shinjuku",
  partySize: 3,
  startAt: "2030-05-17T17:00:00+09:00",
  endAt: "2030-05-17T22:00:00+09:00",
  budgetPerPersonYen: 4_000,
  includeMeal: true,
  interestPreset: "CALM_QUIET",
  maxWalkMinutesPerLeg: 20,
  excludedTags: [],
};
const asOf = new Date("2030-05-17T12:00:00+09:00");
const reviewedFor = (pack: AreaDataPackV3) => ({
  [pack.packVersion]: createReviewedPackClaimsV3(pack),
});
const compose = (pack: AreaDataPackV3, nextIntent = intent) =>
  composeEveningPlanV3({
    intent: nextIntent,
    dataPack: pack,
    reviewedClaims: reviewedFor(pack),
    asOf,
  });

describe("planner v3 bundle engine", () => {
  it("PV3-BE-001 derives conservative coordinate estimates", () => {
    const result = estimateCoordinateTravelV3(
      { latitude: 35.6909, longitude: 139.7003 },
      { latitude: 35.695, longitude: 139.705 },
    );
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.minutes % 5).toBe(0);
  });

  it("PV3-BE-002 composes deterministic A-M-A routes", async () => {
    const pack = createPack();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => compose(pack)),
    );
    expect(
      new Set(results.map((result) => JSON.stringify(result))),
    ).toHaveLength(1);
    const result = results[0]!;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.stops.map(({ place }) => place.role)).toEqual([
      "ACTIVITY",
      "MEAL",
      "ACTIVITY",
    ]);
    expect(result.plan.planId).toMatch(/^plan-[a-f0-9]{24}$/);
    expect(result.plan.candidateSetId).toBe(
      await createCandidateSetIdV3(intent, pack),
    );
    expect(result.plan.totals.estimatedGroupMaxYen).toBe(
      result.plan.totals.perPersonMaxYen * 3,
    );
  });

  it("PV3-BE-003 falls back A-M and supports activity-only grammar", async () => {
    const pack = createPack();
    const short = await compose(pack, {
      ...intent,
      startAt: "2030-05-17T17:00:00+09:00",
      endAt: "2030-05-17T19:00:00+09:00",
    });
    expect(short.ok).toBe(true);
    if (short.ok) {
      expect(short.plan.stops.map(({ place }) => place.role)).toEqual([
        "ACTIVITY",
        "MEAL",
      ]);
    }

    const activityOnly = await compose(pack, {
      ...intent,
      includeMeal: false,
      interestPreset: "ART_HERITAGE",
    });
    expect(activityOnly.ok).toBe(true);
    if (activityOnly.ok) {
      expect(
        activityOnly.plan.stops.every(({ place }) => place.role === "ACTIVITY"),
      ).toBe(true);
    }
  });

  it("PV3-BE-004 enforces budget, exclusion, walking, and preference", async () => {
    const pack = createPack();
    expect(await compose(pack, { ...intent, budgetPerPersonYen: 999 })).toEqual(
      { ok: false, code: "NO_VALID_PLAN" },
    );
    expect(await compose(pack, { ...intent, excludedTags: ["food"] })).toEqual({
      ok: false,
      code: "NO_VALID_PLAN",
    });
    expect(
      await compose(pack, {
        ...intent,
        interestPreset: "HANDS_ON",
        maxWalkMinutesPerLeg: 5,
      }),
    ).toMatchObject({ ok: true });

    const noMatch = createPack();
    noMatch.places.forEach((candidate) => {
      candidate.tags = candidate.role === "MEAL" ? ["food"] : ["quiet"];
    });
    expect(
      await compose(noMatch, { ...intent, interestPreset: "ART_HERITAGE" }),
    ).toEqual({ ok: false, code: "NO_VALID_PLAN" });
  });

  it("PV3-BE-005 calculates FREE, PER_PERSON, and PER_GROUP consistently", async () => {
    const pack = createPack();
    pack.places[0]!.price = {
      kind: "PER_GROUP",
      minYen: 900,
      maxYen: 1_500,
      label: "Published group admission",
    };
    pack.places[0]!.evidence.price = pack.places[0]!.evidence.identity;
    const result = await compose(pack, {
      ...intent,
      interestPreset: "ART_HERITAGE",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const groupStop = result.plan.stops.find(
      ({ place }) => place.placeId === pack.places[0]!.placeId,
    );
    expect(groupStop?.cost.perPersonMaxYen).toBe(500);
    expect(groupStop?.cost.estimatedGroupMaxYen).toBe(1_500);
  });

  it("PV3-BE-006 keeps swaps in the same role and makes cheaper strict", async () => {
    const pack = createPack();
    const initial = await compose(pack);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const mealIndex = initial.plan.stops.findIndex(
      ({ place }) => place.role === "MEAL",
    );
    const swapped = await swapEveningPlanStopV3({
      schemaVersion: "3",
      candidateSetId: initial.plan.candidateSetId,
      planId: initial.plan.planId,
      intent,
      plan: initial.plan,
      stopIndex: mealIndex,
      preference: "CHEAPER",
      dataPack: pack,
      reviewedClaims: reviewedFor(pack),
      asOf,
    });
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    expect(swapped.plan.stops[mealIndex]!.place.role).toBe("MEAL");
    expect(swapped.plan.stops[mealIndex]!.cost.perPersonMaxYen).toBeLessThan(
      initial.plan.stops[mealIndex]!.cost.perPersonMaxYen,
    );
  });

  it("PV3-BE-007 rejects pack drift and stale plan snapshots", async () => {
    const pack = createPack();
    const ledger = reviewedFor(pack);
    pack.places[0]!.name = "Unreviewed place";
    expect(
      validateActiveAreaDataPackV3(pack, ledger, asOf, intent),
    ).toMatchObject({ ok: false, reason: "UNREVIEWED_DATA_PACK" });

    const clean = createPack();
    const initial = await compose(clean);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    const tampered = structuredClone(initial.plan) as Mutable<EveningPlanV3>;
    tampered.stops[0]!.place.summary = "Client tampering";
    expect(
      await swapEveningPlanStopV3({
        schemaVersion: "3",
        candidateSetId: tampered.candidateSetId,
        planId: tampered.planId,
        intent,
        plan: tampered,
        stopIndex: 0,
        preference: "DIFFERENT_INTEREST",
        dataPack: clean,
        reviewedClaims: reviewedFor(clean),
        asOf,
      }),
    ).toEqual({ ok: false, code: "STALE_PLAN" });

    expect(
      await swapEveningPlanStopV3({
        schemaVersion: "3",
        candidateSetId: initial.plan.candidateSetId,
        planId: initial.plan.planId,
        intent,
        plan: initial.plan,
        stopIndex: 0,
        preference: "DIFFERENT_INTEREST",
        dataPack: clean,
        reviewedClaims: reviewedFor(clean),
        asOf: new Date("2030-05-18T00:01:00+09:00"),
      }),
    ).toEqual({ ok: false, code: "STALE_PLAN" });
  });
});
