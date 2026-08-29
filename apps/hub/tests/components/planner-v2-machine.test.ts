import type {
  EveningPlanV2,
  PlaceEvidenceV2,
  PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";
import { describe, expect, it } from "vitest";

import {
  initialPlannerState,
  plannerBusy,
  plannerReducer,
} from "../../components/planner-v2/planner-machine";

const intent = { schemaVersion: "2" } as PlannerIntentV2;
const plan = { planId: "plan-1" } as EveningPlanV2;
const error = {
  code: "NO_REPLACEMENT" as const,
  message: "No safe replacement fits.",
  retryable: false,
};

describe("planner v2 state machine", () => {
  it("moves from one search into one planned result", () => {
    const searching = plannerReducer(initialPlannerState, {
      intent,
      type: "SEARCH_STARTED",
    });
    expect(searching.phase).toBe("searching");
    expect(plannerBusy(searching)).toBe(true);

    const planned = plannerReducer(searching, {
      candidateSetId: "candidate-1",
      plan,
      type: "SEARCH_SUCCEEDED",
      warnings: ["Recheck this source."],
    });
    expect(planned).toMatchObject({
      candidateSetId: "candidate-1",
      phase: "planned",
      plan,
      warnings: ["Recheck this source."],
    });
  });

  it("preserves the current plan when a swap cannot be completed", () => {
    const planned = {
      ...initialPlannerState,
      candidateSetId: "candidate-1",
      evidenceLoadingPlaceId: "place-being-loaded",
      intent,
      phase: "planned" as const,
      plan,
    };
    const swapping = plannerReducer(planned, { type: "SWAP_STARTED" });
    expect(swapping.evidenceLoadingPlaceId).toBeNull();
    const failed = plannerReducer(swapping, {
      error,
      type: "SWAP_FAILED",
    });
    expect(failed.phase).toBe("planned");
    expect(failed.plan).toBe(plan);
    expect(failed.inlineError).toEqual(error);
  });

  it("replaces stale source warnings after a successful swap", () => {
    const planned = {
      ...initialPlannerState,
      candidateSetId: "candidate-1",
      intent,
      phase: "planned" as const,
      plan,
      warnings: ["SOURCE_RECHECK_RECOMMENDED:removed-place"],
    };
    const swapping = plannerReducer(planned, { type: "SWAP_STARTED" });
    const succeeded = plannerReducer(swapping, {
      plan,
      type: "SWAP_SUCCEEDED",
      warnings: ["SOURCE_RECHECK_RECOMMENDED:replacement-place"],
    });

    expect(succeeded.warnings).toEqual([
      "SOURCE_RECHECK_RECOMMENDED:replacement-place",
    ]);
  });

  it("does not accept stale success events outside the matching phase", () => {
    expect(
      plannerReducer(initialPlannerState, {
        candidateSetId: "stale",
        plan,
        type: "SEARCH_SUCCEEDED",
        warnings: [],
      }),
    ).toBe(initialPlannerState);
  });

  it.each([
    ["NO_VALID_PLAN", "SEARCH_EMPTY"],
    ["CANCELLED", "SEARCH_FAILED"],
  ] as const)(
    "preserves a verified plan when a replacement search ends with %s",
    (code, type) => {
      const previousIntent = intent;
      const nextIntent = { ...intent, totalBudgetYen: 1 } as PlannerIntentV2;
      const planned = {
        ...initialPlannerState,
        candidateSetId: "candidate-1",
        evidenceByPlace: {
          "place-1": { placeId: "place-1" } as PlaceEvidenceV2,
        },
        intent: previousIntent,
        phase: "planned" as const,
        plan,
        warnings: ["Keep this warning."],
      };
      const searching = plannerReducer(planned, {
        intent: nextIntent,
        type: "SEARCH_STARTED",
      });
      const restored = plannerReducer(searching, {
        error: {
          code,
          message: "The replacement search did not complete.",
          retryable: code === "CANCELLED",
        },
        type,
      });

      expect(restored).toMatchObject({
        candidateSetId: "candidate-1",
        evidenceByPlace: planned.evidenceByPlace,
        intent: previousIntent,
        pendingIntent: null,
        phase: "planned",
        plan,
        warnings: ["Keep this warning."],
      });
    },
  );

  it("ignores evidence that finishes after the plan changes", () => {
    const oldPlan = {
      planId: "old-plan",
      stops: [{ place: { placeId: "old-place" } }],
    } as EveningPlanV2;
    const newPlan = {
      planId: "new-plan",
      stops: [{ place: { placeId: "new-place" } }],
    } as EveningPlanV2;
    const evidence = {
      placeId: "old-place",
    } as PlaceEvidenceV2;
    const newState = {
      ...initialPlannerState,
      candidateSetId: "new-candidate",
      phase: "planned" as const,
      plan: newPlan,
    };

    expect(
      plannerReducer(newState, {
        evidence,
        placeId: "old-place",
        planId: oldPlan.planId,
        type: "EVIDENCE_SUCCEEDED",
      }),
    ).toBe(newState);
  });

  it("keeps the plan when browser storage fails", () => {
    const planned = {
      ...initialPlannerState,
      phase: "planned" as const,
      plan,
    };
    const pending = plannerReducer(planned, { type: "SAVE_STARTED" });
    const failed = plannerReducer(pending, {
      error: {
        code: "STORAGE_UNAVAILABLE",
        message: "Storage unavailable.",
        retryable: false,
      },
      type: "SAVE_FAILED",
    });
    expect(failed.plan).toBe(plan);
    expect(failed.storagePending).toBe(false);
  });

  it("clears a readable corruption warning after an explicit repair mutation", () => {
    const repaired = plannerReducer(
      { ...initialPlannerState, storageCorrupt: true },
      { records: [], type: "DELETE_SUCCEEDED" },
    );
    expect(repaired.storageCorrupt).toBe(false);
  });
});
