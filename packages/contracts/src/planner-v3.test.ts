import { describe, expect, it } from "vitest";

import {
  PLANNER_V3_AREAS,
  PLANNER_V3_INTEREST_PRESETS,
  createReviewedPackClaimsV3,
  plannerEnvelopeV3Schema,
  validateAreaDataPackV3,
  validateDeleteSavedPlanInputV3,
  validateEveningPlanV3,
  validatePlannerIntentV3,
  validateReviewedPackClaimsV3,
  validateSavePlanInputV3,
  validateShowPlaceEvidenceInputV3,
  validateSwapPlanInputV3,
  type AreaDataPackV3,
  type EveningPlanV3,
  type PlannerIntentV3,
  type PlannerPlaceV3,
} from "./planner-v3";
import {
  plannerIntentV3ClientSchema,
  validatePlannerEnvelopeV3Client,
  validatePlannerIntentV3Client,
} from "./planner-v3-shared";

type Mutable<T> = T extends readonly (infer U)[]
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;

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
  excludedTags: ["lively"],
};

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
  title: `${sourceId} official source`,
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
  priceMax = role === "MEAL" ? 2_000 : 0,
): PlannerPlaceV3 => {
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
    summary: `A concise ${role.toLowerCase()} fixture.`,
    category:
      role === "MEAL" ? "restaurant" : index % 2 === 0 ? "gallery" : "museum",
    address: `${index} Fixture Street, Tokyo`,
    coordinates: {
      latitude: 35.69 + index * 0.0001,
      longitude: 139.7 + index * 0.0001,
    },
    tags: role === "MEAL" ? ["food", "quiet"] : ["art", "quiet"],
    officialUrl: `https://example.com/${sourceId}`,
    googlePlaceId: role === "MEAL" ? `ChIJfixture${index}` : null,
    recommendedVisitMinutes: role === "MEAL" ? 60 : 45,
    weeklyHours: [
      {
        days: [0, 1, 2, 3, 4, 5, 6],
        opens: "12:00",
        closes: "23:00",
      },
    ],
    dateExceptions: [],
    price:
      priceMax === 0
        ? { kind: "FREE", minYen: 0, maxYen: 0, label: "Free" }
        : {
            kind: "PER_PERSON",
            minYen: priceMax - 500,
            maxYen: priceMax,
            label: "Published dinner menu",
          },
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

const createPack = (): AreaDataPackV3 => {
  const places = [
    ...Array.from({ length: 4 }, (_, index) => place(index, "ACTIVITY")),
    ...Array.from({ length: 3 }, (_, index) => place(index + 10, "MEAL")),
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
      attribution: "See each source record.",
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

const createPlan = (): EveningPlanV3 => ({
  schemaVersion: "3",
  planId: "plan-fixture",
  candidateSetId: "candidates-fixture",
  packVersion: "1.0.0",
  intent,
  stops: [
    {
      position: 0,
      place: {
        placeId: "activity-0-place",
        role: "ACTIVITY",
        name: "Activity 0",
        summary: "A concise activity fixture.",
        category: "gallery",
        address: "0 Fixture Street, Tokyo",
        tags: ["art", "quiet"],
        officialUrl: "https://example.com/activity-0",
        googlePlaceId: null,
      },
      startsAt: "2030-05-17T17:05:00+09:00",
      endsAt: "2030-05-17T17:50:00+09:00",
      price: { kind: "FREE", minYen: 0, maxYen: 0, label: "Free" },
      cost: {
        perPersonMinYen: 0,
        perPersonMaxYen: 0,
        estimatedGroupMinYen: 0,
        estimatedGroupMaxYen: 0,
      },
      travelFromPreviousMinutes: 5,
      travelFromPreviousDistanceMeters: 250,
      travelOriginLabel: "Shinjuku Station",
      travelMethod: "COORDINATE_ESTIMATE",
      openingFit: "Published hours cover this visit.",
      whyThisStop: "Matches calm and quiet.",
      sourcePublisher: "Fixture publisher",
      sourceCheckedAt: "2030-05-16T10:00:00+09:00",
    },
    {
      position: 1,
      place: {
        placeId: "meal-10-place",
        role: "MEAL",
        name: "Meal 10",
        summary: "A concise meal fixture.",
        category: "restaurant",
        address: "10 Fixture Street, Tokyo",
        tags: ["food", "quiet"],
        officialUrl: "https://example.com/meal-10",
        googlePlaceId: "ChIJfixture10",
      },
      startsAt: "2030-05-17T17:55:00+09:00",
      endsAt: "2030-05-17T18:55:00+09:00",
      price: {
        kind: "PER_PERSON",
        minYen: 1_500,
        maxYen: 2_000,
        label: "Published dinner menu",
      },
      cost: {
        perPersonMinYen: 1_500,
        perPersonMaxYen: 2_000,
        estimatedGroupMinYen: 4_500,
        estimatedGroupMaxYen: 6_000,
      },
      travelFromPreviousMinutes: 5,
      travelFromPreviousDistanceMeters: 250,
      travelOriginLabel: "Activity 0",
      travelMethod: "COORDINATE_ESTIMATE",
      openingFit: "Published hours cover this visit.",
      whyThisStop: "Adds a published-price meal.",
      sourcePublisher: "Fixture publisher",
      sourceCheckedAt: "2030-05-16T10:00:00+09:00",
    },
  ],
  totals: {
    perPersonMinYen: 1_500,
    perPersonMaxYen: 2_000,
    estimatedGroupMinYen: 4_500,
    estimatedGroupMaxYen: 6_000,
    totalWalkMinutes: 10,
    stopCount: 2,
    startsAt: "2030-05-17T17:05:00+09:00",
    endsAt: "2030-05-17T18:55:00+09:00",
  },
  score: 80,
  scoreBreakdown: {
    preferenceFit: 1,
    walkingEfficiency: 0.9,
    timeUtilization: 0.4,
    categoryDiversity: 1,
  },
  reasonCodes: ["MATCHES_INTEREST", "WITHIN_BUDGET"],
  travelMethod: "COORDINATE_ESTIMATE",
  disclaimer:
    "Built from published information, not live availability. Check each official site before you go.",
});

describe("planner v3 contracts", () => {
  it("PV3-CT-001 accepts the three hubs, 1-3 adults, and six presets", () => {
    expect(PLANNER_V3_AREAS).toEqual(["shibuya", "shinjuku", "ikebukuro"]);
    expect(PLANNER_V3_INTEREST_PRESETS).toHaveLength(6);
    for (const area of PLANNER_V3_AREAS) {
      for (const partySize of [1, 2, 3] as const) {
        expect(validatePlannerIntentV3({ ...intent, area, partySize }).ok).toBe(
          true,
        );
      }
    }
  });

  it("PV3-CT-002 rejects food without a meal and strict boundary failures", () => {
    expect(
      validatePlannerIntentV3({
        ...intent,
        includeMeal: false,
        interestPreset: "FOOD_DISCOVERY",
      }).ok,
    ).toBe(false);
    expect(validatePlannerIntentV3({ ...intent, partySize: 4 }).ok).toBe(false);
    expect(
      validatePlannerIntentV3({ ...intent, budgetPerPersonYen: 30_001 }).ok,
    ).toBe(false);
    expect(
      validatePlannerIntentV3({
        ...intent,
        startAt: "2030-02-30T17:00:00+09:00",
      }).ok,
    ).toBe(false);
  });

  it("PV3-CT-003 keeps the lightweight client guard aligned", () => {
    const now = new Date("2030-05-17T01:00:00Z");
    expect(validatePlannerIntentV3Client(intent, now)).toEqual({ ok: true });
    expect(plannerIntentV3ClientSchema.properties.area.enum).toEqual([
      "shibuya",
      "shinjuku",
      "ikebukuro",
    ]);
    expect(
      validatePlannerIntentV3Client(
        { ...intent, includeMeal: false, interestPreset: "FOOD_DISCOVERY" },
        now,
      ).ok,
    ).toBe(false);
  });

  it("PV3-CT-004 validates ACTIVE source-backed area packs", () => {
    const pack = createPack();
    expect(validateAreaDataPackV3(pack)).toEqual({ ok: true, value: pack });

    const missingMeal = structuredClone(pack) as Mutable<AreaDataPackV3>;
    missingMeal.places = missingMeal.places.filter(
      ({ placeId }) => placeId !== "meal-12-place",
    );
    expect(validateAreaDataPackV3(missingMeal).ok).toBe(false);

    const nonOfficialMeal = structuredClone(pack) as Mutable<AreaDataPackV3>;
    const meal = nonOfficialMeal.places.find(({ role }) => role === "MEAL")!;
    meal.price = {
      kind: "PER_GROUP",
      minYen: 1_000,
      maxYen: 2_000,
      label: "Group",
    };
    expect(validateAreaDataPackV3(nonOfficialMeal).ok).toBe(false);
  });

  it("PV3-CT-005 fails closed on evidence, date, and source tampering", () => {
    const badEvidence = structuredClone(
      createPack(),
    ) as Mutable<AreaDataPackV3>;
    badEvidence.places[0]!.evidence.hours.sourceId = "unknown";
    expect(validateAreaDataPackV3(badEvidence).ok).toBe(false);

    const badDate = structuredClone(createPack()) as Mutable<AreaDataPackV3>;
    badDate.places[0]!.dateExceptions.push({
      date: "2030-02-30",
      closed: true,
      note: "Impossible",
    });
    expect(validateAreaDataPackV3(badDate).ok).toBe(false);

    const badSource = structuredClone(createPack()) as Mutable<AreaDataPackV3>;
    badSource.sources[0]!.checkedAt = "2030-05-18T10:00:00+09:00";
    expect(validateAreaDataPackV3(badSource).ok).toBe(false);
  });

  it("PV3-CT-006 binds the runtime pack to reviewed claims", () => {
    const pack = structuredClone(createPack()) as Mutable<AreaDataPackV3>;
    const ledger = {
      [pack.packVersion]: createReviewedPackClaimsV3(pack),
    };
    expect(validateReviewedPackClaimsV3(pack, ledger).ok).toBe(true);
    pack.places[0]!.name = "Unreviewed replacement";
    expect(validateReviewedPackClaimsV3(pack, ledger).ok).toBe(false);
  });

  it("PV3-CT-007 validates plan totals, grammar, and input linkage", () => {
    const plan = createPlan();
    expect(validateEveningPlanV3(plan).ok).toBe(true);
    expect(
      validateSwapPlanInputV3({
        schemaVersion: "3",
        candidateSetId: plan.candidateSetId,
        planId: plan.planId,
        intent,
        plan,
        stopIndex: 1,
        preference: "CHEAPER",
      }).ok,
    ).toBe(true);
    expect(
      validateShowPlaceEvidenceInputV3({
        schemaVersion: "3",
        area: "shinjuku",
        packVersion: "1.0.0",
        placeId: "meal-10-place",
      }).ok,
    ).toBe(true);
    expect(
      validateSavePlanInputV3({
        schemaVersion: "3",
        candidateSetId: plan.candidateSetId,
        planId: plan.planId,
      }).ok,
    ).toBe(true);
    expect(
      validateDeleteSavedPlanInputV3({
        schemaVersion: "3",
        planId: plan.planId,
      }).ok,
    ).toBe(true);

    const badTotals = structuredClone(plan) as Mutable<EveningPlanV3>;
    badTotals.totals.estimatedGroupMaxYen = 1;
    expect(validateEveningPlanV3(badTotals).ok).toBe(false);
  });

  it("PV3-CT-008 exposes strict success and failure envelopes", () => {
    const envelope = {
      schemaVersion: "3",
      ok: false,
      error: {
        code: "NO_VALID_PLAN",
        message: "No route found.",
        retryable: false,
      },
      meta: {
        correlationId: "corr-1",
        origin: "https://hub.example",
        completedAt: "2030-05-17T09:00:00.000Z",
        packVersion: "1.0.0",
        area: "shinjuku",
      },
    } as const;
    expect(validatePlannerEnvelopeV3Client(envelope)).toBe(true);
    expect(
      validatePlannerEnvelopeV3Client({
        ...envelope,
        meta: { ...envelope.meta, area: null, packVersion: null },
      }),
    ).toBe(true);
    expect(plannerEnvelopeV3Schema({} as const).oneOf).toHaveLength(2);
    expect(
      validatePlannerEnvelopeV3Client({
        ...envelope,
        error: { ...envelope.error, clientSecret: "poison" },
      }),
    ).toBe(false);
  });
});
