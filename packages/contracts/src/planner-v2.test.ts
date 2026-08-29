import { describe, expect, it } from "vitest";

import {
  PLANNER_ERROR_CODES,
  PLANNER_SCHEMA_VERSION,
  type PlaceDataPackV2,
  createReviewedPackClaimsV2,
  isStrictCalendarDateV2,
  isStrictTimestampV2,
  validateDeleteSavedPlanInputV2,
  validatePlaceDataPackV2,
  validatePlannerEnvelopeV2,
  validatePlannerIntentV2,
  validateReviewedPlaceDataPackV2,
  validateSavePlanInputV2,
  validateShowPlaceEvidenceInputV2,
  validateSwapPlanInputV2,
} from "./planner-v2";
import rawShibuyaPack from "../../../apps/hub/data/shibuya.places.v2.json";
import reviewedClaimLedger from "../../../apps/hub/data/shibuya-v2.reviewed-claims.json";
import {
  plannerIntentV2ClientSchema,
  validatePlannerEnvelopeV2Client,
  validatePlannerIntentV2Client,
} from "./planner-v2-shared";

const intent = {
  schemaVersion: "2",
  area: "shibuya",
  partySize: 1,
  startAt: "2030-05-17T17:00:00+09:00",
  endAt: "2030-05-17T22:00:00+09:00",
  totalBudgetYen: 5000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: ["art", "quiet"],
  excludedTags: ["alcohol", "smoking"],
} as const;

describe("planner v2 contracts", () => {
  it("PV2-CT-001 accepts one JST day and a 2-10 hour window", () => {
    expect(validatePlannerIntentV2(intent)).toEqual({
      ok: true,
      value: intent,
    });
  });

  it("PV2-CT-002 rejects cross-day, overlapping tags, and non-JST intent", () => {
    expect(
      validatePlannerIntentV2({
        ...intent,
        endAt: "2030-05-18T01:00:00+09:00",
      }).ok,
    ).toBe(false);
    expect(
      validatePlannerIntentV2({
        ...intent,
        excludedTags: ["quiet"],
      }).ok,
    ).toBe(false);
    expect(
      validatePlannerIntentV2({
        ...intent,
        startAt: "2030-05-17T08:00:00Z",
      }).ok,
    ).toBe(false);
  });

  it("PV2-CT-003 optionally enforces today through seven days", () => {
    const now = new Date("2030-05-17T01:00:00Z");
    expect(validatePlannerIntentV2(intent, { now }).ok).toBe(true);
    expect(
      validatePlannerIntentV2(
        {
          ...intent,
          startAt: "2030-05-25T17:00:00+09:00",
          endAt: "2030-05-25T22:00:00+09:00",
        },
        { now },
      ).ok,
    ).toBe(false);
  });

  it("PV2-CT-003e allows a five-minute start grace and rejects six minutes", () => {
    expect(
      validatePlannerIntentV2(intent, {
        now: new Date("2030-05-17T08:05:00Z"),
      }).ok,
    ).toBe(true);
    const rejected = validatePlannerIntentV2(intent, {
      now: new Date("2030-05-17T08:06:00Z"),
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.issues).toContain(
        "/startAt must not be more than five minutes in the past",
      );
    }
  });

  it("PV2-CT-003a keeps the lightweight Site Tool guard aligned", () => {
    const now = new Date("2030-05-17T01:00:00Z");
    expect(validatePlannerIntentV2Client(intent, now).ok).toBe(true);
    expect(
      validatePlannerIntentV2Client({ ...intent, totalBudgetYen: 30_001 }, now)
        .ok,
    ).toBe(false);
    expect(plannerIntentV2ClientSchema.properties.stopCount).toEqual({
      const: "AUTO",
    });
    expect(
      validatePlannerEnvelopeV2Client({
        data: {},
        meta: {
          completedAt: "2030-05-17T09:00:00.000Z",
          correlationId: "client-envelope-1",
          origin: "https://hub.test",
          packVersion: "1.0.0",
        },
        ok: true,
        schemaVersion: "2",
      }),
    ).toBe(true);
  });

  it("PV2-CT-003b enforces product budget, tag, and evening bounds", () => {
    expect(
      validatePlannerIntentV2({ ...intent, totalBudgetYen: 30_001 }).ok,
    ).toBe(false);
    expect(
      validatePlannerIntentV2({
        ...intent,
        preferredTags: ["art", "books", "coffee-tea", "food", "music", "quiet"],
      }).ok,
    ).toBe(false);
    expect(
      validatePlannerIntentV2({
        ...intent,
        startAt: "2030-05-17T11:59:00+09:00",
        endAt: "2030-05-17T21:59:00+09:00",
      }).ok,
    ).toBe(false);
    expect(
      validatePlannerIntentV2({
        ...intent,
        startAt: "2030-05-17T13:31:00+09:00",
        endAt: "2030-05-17T23:31:00+09:00",
      }).ok,
    ).toBe(false);
    expect(PLANNER_ERROR_CODES).toContain("STORAGE_UNAVAILABLE");
    expect(PLANNER_ERROR_CODES).toContain("STORAGE_CORRUPT");
    expect(PLANNER_ERROR_CODES).not.toContain("STORAGE_ERROR" as never);
  });

  it("PV2-CT-003c separates published, incomplete, and no-set hours", () => {
    expect(validatePlaceDataPackV2(rawShibuyaPack).ok).toBe(true);

    const noSetWithWindow = structuredClone(
      rawShibuyaPack,
    ) as unknown as PlaceDataPackV2;
    const noSetPlace = noSetWithWindow.places[0];
    expect(noSetPlace).toBeTruthy();
    if (!noSetPlace) return;
    noSetPlace.hoursProvenance = {
      kind: "NO_SET_HOURS",
      sourceSummary: "The cited source publishes no set hours.",
    };
    noSetPlace.routeEligibility = {
      kind: "REFERENCE_ONLY",
      reasons: ["NO_SET_HOURS"],
      note: "Focused no-set-hours fixture.",
    };
    noSetPlace.weeklyHours = [
      { days: [0, 1, 2, 3, 4, 5, 6], opens: "00:00", closes: "23:59" },
    ];
    expect(validatePlaceDataPackV2(noSetWithWindow).ok).toBe(false);

    const inferredAllDay = structuredClone(
      rawShibuyaPack,
    ) as unknown as PlaceDataPackV2;
    const gallery = inferredAllDay.places.find(
      ({ placeId }) => placeId === "kawamoto-puppet-gallery",
    );
    expect(gallery).toBeTruthy();
    if (!gallery || gallery.hoursProvenance.kind !== "PUBLISHED_WINDOWS") {
      return;
    }
    gallery.weeklyHours = [
      { days: [0, 1, 2, 3, 4, 5, 6], opens: "00:00", closes: "23:59" },
    ];
    gallery.hoursProvenance.publishedAllDay = false;
    expect(validatePlaceDataPackV2(inferredAllDay).ok).toBe(false);

    const routableIncomplete = structuredClone(
      rawShibuyaPack,
    ) as unknown as PlaceDataPackV2;
    const library = routableIncomplete.places.find(
      ({ placeId }) => placeId === "komorebi-owada-library",
    );
    expect(library).toBeTruthy();
    if (!library) return;
    library.hoursProvenance = {
      kind: "PUBLISHED_INCOMPLETE",
      sourceSummary:
        "The official schedule has recurring closures that are not fully modeled.",
    };
    library.routeEligibility = { kind: "ROUTABLE" };
    expect(validatePlaceDataPackV2(routableIncomplete).ok).toBe(false);
  });

  it("PV2-CT-003d bounds every pack to sixty Tokyo calendar days", () => {
    const overlong = structuredClone(rawShibuyaPack);
    overlong.validThrough = "2026-10-30T23:59:59+09:00";
    expect(validatePlaceDataPackV2(overlong).ok).toBe(false);

    const wrongOffset = structuredClone(rawShibuyaPack);
    wrongOffset.validThrough = "2026-09-06T14:59:59Z";
    expect(validatePlaceDataPackV2(wrongOffset).ok).toBe(false);
  });

  it("PV2-CT-003h requires official calendar sources and horizon-safe exceptions", () => {
    const missingCalendar = structuredClone(rawShibuyaPack);
    missingCalendar.calendarSourceIds = ["missing-calendar-source"];
    expect(validatePlaceDataPackV2(missingCalendar).ok).toBe(false);

    const staleCalendar = structuredClone(rawShibuyaPack);
    staleCalendar.sources.find(
      ({ sourceId }) => sourceId === "shibuya-library-opening-calendar",
    )!.checkedAt = "2026-08-29T00:00:00+09:00";
    expect(validatePlaceDataPackV2(staleCalendar).ok).toBe(false);

    const duplicateException = structuredClone(rawShibuyaPack);
    duplicateException.places[0]!.dateExceptions.push(
      structuredClone(duplicateException.places[0]!.dateExceptions[0]!),
    );
    expect(validatePlaceDataPackV2(duplicateException).ok).toBe(false);

    const outsideHorizon = structuredClone(rawShibuyaPack);
    outsideHorizon.places[0]!.dateExceptions.push({
      date: "2026-10-29",
      closed: true,
      note: "Outside the audited horizon",
    });
    expect(validatePlaceDataPackV2(outsideHorizon).ok).toBe(false);
  });

  it("PV2-CT-003f requires public-access evidence with authorized scope", () => {
    const missing = structuredClone(rawShibuyaPack) as unknown as {
      places: Array<{ evidence: { publicAccess?: unknown } }>;
    };
    delete missing.places[0]?.evidence.publicAccess;
    expect(validatePlaceDataPackV2(missing).ok).toBe(false);

    const unsupported = structuredClone(rawShibuyaPack);
    const first = unsupported.places[0];
    expect(first).toBeTruthy();
    if (!first) return;
    first.evidence.publicAccess = first.evidence.coordinates;
    expect(validatePlaceDataPackV2(unsupported).ok).toBe(false);
  });

  it("PV2-CT-003g binds every published planning claim to a reviewed snapshot", () => {
    expect(
      validateReviewedPlaceDataPackV2(rawShibuyaPack, reviewedClaimLedger).ok,
    ).toBe(true);
    const reviewed = createReviewedPackClaimsV2(
      rawShibuyaPack as unknown as PlaceDataPackV2,
    );
    expect(reviewed.places).toHaveLength(9);
    expect(reviewed.calendarSources).toHaveLength(2);

    const mutations: Array<(pack: PlaceDataPackV2) => void> = [
      (pack) => {
        pack.places[0]!.address = "Unreviewed address";
      },
      (pack) => {
        const coordinates = pack.places[0]!.coordinates;
        if (coordinates) coordinates.latitude += 0.01;
      },
      (pack) => {
        pack.places[0]!.weeklyHours[0]!.closes = "17:55";
      },
      (pack) => {
        const price = pack.places[0]!.price;
        if (price.kind === "EXACT") {
          price.maxYen += 100;
          price.minYen += 100;
        }
      },
      (pack) => {
        pack.places[0]!.routeEligibility = {
          kind: "REFERENCE_ONLY",
          reasons: ["RESTRICTED_ACCESS"],
          note: "Unreviewed access change",
        };
      },
      (pack) => {
        pack.places[0]!.officialUrl =
          "https://www.city.shibuya.tokyo.jp/unreviewed";
      },
      (pack) => {
        pack.sources.find(
          ({ sourceId }) => sourceId === "shibuya-city-asakura",
        )!.url = "https://www.city.shibuya.tokyo.jp/unreviewed-source";
      },
      (pack) => {
        pack.sources.find(
          ({ sourceId }) => sourceId === "shibuya-library-opening-calendar",
        )!.url = "https://www.lib.city.shibuya.tokyo.jp/unreviewed-calendar";
      },
      (pack) => {
        pack.sources.find(
          ({ sourceId }) => sourceId === "shibuya-city-asakura",
        )!.publisher = "Unreviewed publisher";
      },
      (pack) => {
        pack.sources.find(
          ({ sourceId }) => sourceId === "shibuya-city-asakura",
        )!.title = "Unreviewed title";
      },
      (pack) => {
        const source = pack.sources.find(
          ({ sourceId }) => sourceId === "shibuya-city-asakura",
        )!;
        if (source.usage.mode === "OFFICIAL_FACT_REFERENCE") {
          source.usage.attribution = "Unreviewed attribution";
        }
      },
      (pack) => {
        pack.dataLicense.attribution = "Unreviewed pack attribution";
      },
      (pack) => {
        pack.dataLicense.licenseUrl =
          "https://example.com/unreviewed-data-license";
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(
        rawShibuyaPack,
      ) as unknown as PlaceDataPackV2;
      mutate(changed);
      expect(
        validateReviewedPlaceDataPackV2(changed, reviewedClaimLedger).ok,
      ).toBe(false);
    }
  });

  it("PV2-CT-004 validates stateless swap and compact storage commands", () => {
    const plan = {
      schemaVersion: "2",
      planId: "plan-1",
      candidateSetId: "candidates-1",
      packVersion: "1.0.0",
      intent,
      stops: [
        {
          position: 0,
          place: {
            placeId: "place-1",
            name: "Place one",
            summary: "A first sourced place.",
            category: "park",
            address: "Shibuya",
            tags: ["outdoors"],
            officialUrl: "https://example.test/place-1",
          },
          startsAt: "2030-05-17T17:10:00+09:00",
          endsAt: "2030-05-17T17:40:00+09:00",
          price: { kind: "FREE", minYen: 0, maxYen: 0, label: "Free" },
          priceProvenance: {
            kind: "PUBLISHED_AMOUNT",
            sourceSummary: "The source publishes free admission.",
          },
          travelFromPreviousMinutes: 10,
          travelFromPreviousDistanceMeters: 600,
          travelOriginLabel: "Shibuya Station",
          travelMethod: "COORDINATE_ESTIMATE",
          travelLabel: "Estimated 10 min walk",
          openingFit: "Open for the visit",
          whyThisStop: "Matches outdoors",
          sourcePublisher: "Publisher",
          sourceCheckedAt: "2030-05-17T12:00:00+09:00",
        },
        {
          position: 1,
          place: {
            placeId: "place-2",
            name: "Place two",
            summary: "A second sourced place.",
            category: "heritage",
            address: "Shibuya",
            tags: ["art"],
            officialUrl: "https://example.test/place-2",
          },
          startsAt: "2030-05-17T17:45:00+09:00",
          endsAt: "2030-05-17T18:15:00+09:00",
          price: { kind: "EXACT", minYen: 500, maxYen: 500, label: "Adult" },
          priceProvenance: {
            kind: "PUBLISHED_AMOUNT",
            sourceSummary: "The source publishes a ¥500 adult admission.",
          },
          travelFromPreviousMinutes: 5,
          travelFromPreviousDistanceMeters: 300,
          travelOriginLabel: "Place one",
          travelMethod: "COORDINATE_ESTIMATE",
          travelLabel: "Estimated 5 min walk",
          openingFit: "Open for the visit",
          whyThisStop: "Matches art",
          sourcePublisher: "Publisher",
          sourceCheckedAt: "2030-05-17T12:00:00+09:00",
        },
      ],
      totals: {
        minPriceYen: 500,
        maxPriceYen: 500,
        totalWalkMinutes: 15,
        stopCount: 2,
        startsAt: "2030-05-17T17:10:00+09:00",
        endsAt: "2030-05-17T18:15:00+09:00",
      },
      score: 80,
      scoreBreakdown: {
        preferenceFit: 1,
        walkingEfficiency: 0.8,
        timeUtilization: 0.5,
        categoryDiversity: 1,
      },
      reasonCodes: ["MATCHES_INTERESTS"],
      travelMethod: "COORDINATE_ESTIMATE",
      disclaimer:
        "Built from published information, not live availability. Check each official site before you go.",
    } as const;
    expect(
      validateSwapPlanInputV2({
        schemaVersion: "2",
        candidateSetId: "candidates-1",
        planId: "plan-1",
        intent,
        plan,
        stopIndex: 1,
        preference: "CHEAPER",
      }).ok,
    ).toBe(true);
    expect(
      validateSavePlanInputV2({
        schemaVersion: "2",
        candidateSetId: "candidates-1",
        planId: "plan-1",
      }).ok,
    ).toBe(true);
    expect(
      validateDeleteSavedPlanInputV2({
        schemaVersion: "2",
        planId: "plan-1",
      }).ok,
    ).toBe(true);
  });

  it("PV2-CT-005 rejects unknown fields, bad indexes, and unsafe URLs", () => {
    expect(
      validateSwapPlanInputV2({
        schemaVersion: "2",
        candidateSetId: "candidates-1",
        planId: "plan-1",
        intent,
        stopIndex: 3,
        preference: "CHEAPER",
      }).ok,
    ).toBe(false);
    expect(
      validateShowPlaceEvidenceInputV2({
        schemaVersion: "2",
        packVersion: "1.0.0",
        placeId: "place-1",
        url: "http://attacker.invalid",
      }).ok,
    ).toBe(false);
  });

  it("PV2-CT-003i rejects normalized impossible calendar dates", () => {
    const impossible = {
      ...intent,
      endAt: "2030-09-31T22:00:00+09:00",
      startAt: "2030-09-31T17:00:00+09:00",
    };
    const now = new Date("2030-09-29T01:00:00Z");
    expect(validatePlannerIntentV2(impossible, { now }).ok).toBe(false);
    expect(validatePlannerIntentV2Client(impossible, now).ok).toBe(false);
  });

  it("PV2-CT-003j rejects impossible dates in every pack timestamp boundary", () => {
    expect(isStrictCalendarDateV2("2026-09-31")).toBe(false);
    expect(isStrictCalendarDateV2("2028-02-29")).toBe(true);
    expect(isStrictTimestampV2("2026-09-31T12:00:00+09:00")).toBe(false);
    expect(isStrictTimestampV2("2028-02-29T12:00:00Z")).toBe(true);

    const mutations: Array<{
      mutate: (pack: PlaceDataPackV2) => void;
      path: string;
    }> = [
      {
        path: "/generatedAt",
        mutate: (pack) => {
          pack.generatedAt = "2026-09-31T12:00:00+09:00";
        },
      },
      {
        path: "/validThrough",
        mutate: (pack) => {
          pack.validThrough = "2026-09-31T23:59:59+09:00";
        },
      },
      {
        path: "/sources/0/checkedAt",
        mutate: (pack) => {
          pack.sources[0]!.checkedAt = "2026-09-31T12:00:00+09:00";
        },
      },
      {
        path: "/sources/0/publishedAt",
        mutate: (pack) => {
          pack.sources[0]!.publishedAt = "2026-09-31T12:00:00Z";
        },
      },
      {
        path: "/places/0/evidence/hours/checkedAt",
        mutate: (pack) => {
          pack.places[0]!.evidence.hours.checkedAt =
            "2026-09-31T12:00:00+09:00";
        },
      },
      {
        path: "/places/0/dateExceptions/0/date",
        mutate: (pack) => {
          pack.places[0]!.dateExceptions[0]!.date = "2026-09-31";
        },
      },
    ];

    for (const { mutate, path } of mutations) {
      const changed = structuredClone(
        rawShibuyaPack,
      ) as unknown as PlaceDataPackV2;
      mutate(changed);
      const result = validatePlaceDataPackV2(changed);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.startsWith(path))).toBe(
          true,
        );
        expect(result.issues.some((issue) => /real calendar/.test(issue))).toBe(
          true,
        );
      }
    }
  });

  it("PV2-CT-006a rejects an impossible completedAt in server and client envelopes", () => {
    const envelope = {
      schemaVersion: PLANNER_SCHEMA_VERSION,
      ok: true,
      data: {},
      meta: {
        correlationId: "corr-impossible-date",
        origin: "https://planner.example.test",
        completedAt: "2026-09-31T12:00:00.000Z",
        packVersion: "1.0.0",
      },
    } as const;
    expect(validatePlannerEnvelopeV2(envelope).ok).toBe(false);
    expect(validatePlannerEnvelopeV2Client(envelope)).toBe(false);
  });

  it("PV2-CT-006 validates a generic safe envelope", () => {
    const envelope = {
      schemaVersion: PLANNER_SCHEMA_VERSION,
      ok: true,
      data: { planId: "plan-1" },
      meta: {
        correlationId: "corr-1",
        origin: "https://planner.example.test",
        completedAt: "2030-05-17T17:00:01+09:00",
        packVersion: "1.0.0",
      },
    } as const;
    expect(validatePlannerEnvelopeV2(envelope).ok).toBe(true);
    expect(
      validatePlannerEnvelopeV2({ ...envelope, schemaVersion: "1" }).ok,
    ).toBe(false);
  });
});
