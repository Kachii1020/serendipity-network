import { composeBundles } from "@serendipity/bundle-engine";
import {
  canonicalSlotsByProvider,
  canonicalTravelTimes,
} from "@serendipity/test-fixtures";
import { describe, expect, it } from "vitest";

import { intentFor } from "../../components/product/hub-client";
import {
  BUDGET_PRESETS_YEN,
  DEFAULT_PLAN_CONSTRAINTS,
  START_TIME_PRESETS,
} from "../../components/product/types";

const fixedNow = new Date("2030-05-17T00:00:00.000Z");

describe("time and budget plan constraints", () => {
  it("keeps Shibuya, solo, and 22:30 fixed while changing the shared Intent", () => {
    const intent = intentFor(
      "Hands-on",
      { startTime: "18:30", totalBudgetYen: 6000 },
      fixedNow,
    );

    expect(intent).toMatchObject({
      area: "shibuya",
      endAt: "2030-05-17T22:30:00+09:00",
      partySize: 1,
      preferredTags: ["hands-on", "creative", "beginner"],
      startAt: "2030-05-17T18:30:00+09:00",
      totalBudgetYen: 6000,
    });
    expect(DEFAULT_PLAN_CONSTRAINTS).toEqual({
      startTime: "18:00",
      totalBudgetYen: 5000,
    });
  });

  it("covers every preset pair with a feasible route or an honest no-result", async () => {
    const expectedCandidateCounts: Record<string, number> = {
      "18:00/4500": 3,
      "18:00/5000": 3,
      "18:00/6000": 3,
      "18:30/4500": 0,
      "18:30/5000": 2,
      "18:30/6000": 3,
      "19:00/4500": 0,
      "19:00/5000": 0,
      "19:00/6000": 0,
    };

    for (const startTime of START_TIME_PRESETS) {
      for (const totalBudgetYen of BUDGET_PRESETS_YEN) {
        const result = await composeBundles({
          bundleVersion: 1,
          intent: intentFor(
            "Surprising",
            { startTime, totalBudgetYen },
            fixedNow,
          ),
          slotsByProvider: canonicalSlotsByProvider,
          travelTimes: canonicalTravelTimes,
        });
        const expected =
          expectedCandidateCounts[`${startTime}/${totalBudgetYen}`];

        if (expected === undefined) {
          throw new Error("preset expectation is missing");
        }
        if (expected === 0) {
          expect(result).toMatchObject({ code: "NO_VALID_BUNDLE", ok: false });
        } else {
          expect(result.ok).toBe(true);
          if (result.ok) expect(result.candidates).toHaveLength(expected);
        }
      }
    }
  });
});
