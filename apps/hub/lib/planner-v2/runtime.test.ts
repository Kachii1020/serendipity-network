import {
  PLANNER_SCHEMA_VERSION,
  SWAP_PREFERENCES,
  validateEveningPlanV2,
  type PlannerIntentV2,
  type SwapPlanInputV2,
} from "@serendipity/contracts/planner-v2";
import { describe, expect, it } from "vitest";

import {
  PLANNER_V2_PACK_VERSION,
  readPlaceEvidenceV2,
  searchEveningPlanV2,
  swapEveningPlanV2,
} from "./runtime";

const intent: PlannerIntentV2 = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-29T17:00:00+09:00",
  endAt: "2026-08-29T22:00:00+09:00",
  totalBudgetYen: 5_000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: ["art", "books", "quiet"],
  excludedTags: [],
};

describe("planner v2 server runtime", () => {
  it("builds a validated source-backed plan without external I/O", async () => {
    const result = await searchEveningPlanV2(
      intent,
      new AbortController().signal,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.candidateSetId).toBe(result.data.plan.candidateSetId);
    expect(result.data.plan.packVersion).toBe(PLANNER_V2_PACK_VERSION);
    expect(validateEveningPlanV2(result.data.plan).ok).toBe(true);
    expect(result.data.plan.stops).toHaveLength(3);
    expect(result.data.plan.disclaimer).toContain("not live availability");
  });

  it("returns an honest no-result when every place tag is excluded", async () => {
    const result = await searchEveningPlanV2(
      {
        ...intent,
        preferredTags: [],
        excludedTags: ["art", "books", "hands-on", "outdoors"],
      },
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NO_VALID_PLAN" },
    });
  });

  it("replaces one stop while preserving a stateless validated plan snapshot", async () => {
    const found = await searchEveningPlanV2(
      intent,
      new AbortController().signal,
    );
    expect(found.ok).toBe(true);
    if (!found.ok) return;

    let replacement: Awaited<ReturnType<typeof swapEveningPlanV2>> | undefined;
    let selectedInput: SwapPlanInputV2 | undefined;
    for (const stop of found.data.plan.stops) {
      for (const preference of SWAP_PREFERENCES) {
        const input: SwapPlanInputV2 = {
          schemaVersion: PLANNER_SCHEMA_VERSION,
          candidateSetId: found.data.candidateSetId,
          planId: found.data.plan.planId,
          intent,
          plan: found.data.plan,
          stopIndex: stop.position,
          preference,
        };
        const candidate = await swapEveningPlanV2(
          input,
          new AbortController().signal,
        );
        if (candidate.ok) {
          replacement = candidate;
          selectedInput = input;
          break;
        }
      }
      if (replacement?.ok) break;
    }

    expect(replacement?.ok).toBe(true);
    expect(selectedInput).toBeDefined();
    if (!replacement?.ok || !selectedInput) return;
    expect(validateEveningPlanV2(replacement.data.plan).ok).toBe(true);
    const unchangedPositions = found.data.plan.stops
      .map((stop) => stop.position)
      .filter((position) => position !== selectedInput.stopIndex);
    for (const position of unchangedPositions) {
      expect(replacement.data.plan.stops[position]?.place.placeId).toBe(
        found.data.plan.stops[position]?.place.placeId,
      );
    }
  });

  it("returns source evidence and a normalized missing-place error", () => {
    const found = readPlaceEvidenceV2("kyu-asakura-house");
    expect(found).toMatchObject({
      ok: true,
      data: {
        evidence: {
          packVersion: PLANNER_V2_PACK_VERSION,
          placeId: "kyu-asakura-house",
        },
      },
    });
    expect(readPlaceEvidenceV2("missing-place")).toMatchObject({
      ok: false,
      error: { code: "PLACE_NOT_FOUND" },
    });
  });

  it("honors an already aborted request before composition", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      searchEveningPlanV2(intent, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
