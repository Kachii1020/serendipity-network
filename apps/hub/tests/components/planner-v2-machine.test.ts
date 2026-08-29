import type {
  EveningPlanV2,
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
    });
    expect(planned).toMatchObject({
      candidateSetId: "candidate-1",
      phase: "planned",
      plan,
    });
  });

  it("preserves the current plan when a swap cannot be completed", () => {
    const planned = {
      ...initialPlannerState,
      candidateSetId: "candidate-1",
      intent,
      phase: "planned" as const,
      plan,
    };
    const swapping = plannerReducer(planned, { type: "SWAP_STARTED" });
    const failed = plannerReducer(swapping, {
      error,
      type: "SWAP_FAILED",
    });
    expect(failed.phase).toBe("planned");
    expect(failed.plan).toBe(plan);
    expect(failed.inlineError).toEqual(error);
  });

  it("does not accept stale success events outside the matching phase", () => {
    expect(
      plannerReducer(initialPlannerState, {
        candidateSetId: "stale",
        plan,
        type: "SEARCH_SUCCEEDED",
      }),
    ).toBe(initialPlannerState);
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
});
