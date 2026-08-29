import { describe, expect, it } from "vitest";

import {
  PLANNER_ERROR_CODES,
  PLANNER_SCHEMA_VERSION,
  validateDeleteSavedPlanInputV2,
  validatePlannerEnvelopeV2,
  validatePlannerIntentV2,
  validateSavePlanInputV2,
  validateShowPlaceEvidenceInputV2,
  validateSwapPlanInputV2,
} from "./planner-v2";
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
