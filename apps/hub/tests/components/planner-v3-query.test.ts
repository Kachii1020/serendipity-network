import { describe, expect, it } from "vitest";

import {
  defaultPlannerFormV3,
  normalizePlannerQueryV3,
  plannerFormDefaultsFromIntentV3,
  plannerIntentFromDefaultsV3,
  plannerSearchParamsFromDefaultsV3,
} from "../../components/planner-v3/planner-query";

const clock = new Date("2026-08-29T08:00:00.000Z");

describe("planner v3 query boundary", () => {
  it("starts with the product-contract Shibuya solo surprise defaults", () => {
    expect(defaultPlannerFormV3(clock)).toMatchObject({
      area: "shibuya",
      budgetPerPersonYen: 4000,
      includeMeal: true,
      interestPreset: "SURPRISE",
      partySize: 1,
      walk: 20,
    });
  });

  it("round-trips every assistant-supplied visible constraint", () => {
    const intent = {
      area: "shinjuku" as const,
      budgetPerPersonYen: 7777,
      endAt: "2026-08-30T22:15:00+09:00",
      excludedTags: [
        "art" as const,
        "coffee-tea" as const,
        "outdoors" as const,
      ],
      includeMeal: true,
      interestPreset: "HANDS_ON" as const,
      maxWalkMinutesPerLeg: 17,
      partySize: 3 as const,
      schemaVersion: "3" as const,
      startAt: "2026-08-30T17:15:00+09:00",
    };
    const defaults = plannerFormDefaultsFromIntentV3(intent);
    const params = plannerSearchParamsFromDefaultsV3(defaults);
    const query = Object.fromEntries(
      [...new Set(params.keys())].map((key) => {
        const values = params.getAll(key);
        return [key, values.length === 1 ? values[0] : values];
      }),
    );
    const normalized = normalizePlannerQueryV3(query, clock);

    expect(normalized.invalid).toBe(false);
    const roundTrip = plannerIntentFromDefaultsV3(normalized.defaults);
    expect({
      ...roundTrip,
      excludedTags: [...roundTrip.excludedTags].sort(),
    }).toEqual({
      ...intent,
      excludedTags: [...intent.excludedTags].sort(),
    });
  });

  it("accepts the complete integer walk range and rejects values outside it", () => {
    for (const walk of [5, 15, 17, 25, 30]) {
      const result = normalizePlannerQueryV3({ walk: String(walk) }, clock);
      expect(result.invalid).toBe(false);
      expect(result.defaults.walk).toBe(walk);
    }

    for (const walk of [4, 31]) {
      const result = normalizePlannerQueryV3({ walk: String(walk) }, clock);
      expect(result.invalid).toBe(true);
      expect(result.defaults.walk).toBe(20);
    }
  });
});
