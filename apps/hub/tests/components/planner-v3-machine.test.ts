import type {
  EveningPlanV3,
  PlaceEvidenceV3,
  PlannerIntentV3,
} from "@serendipity/contracts/planner-v3";
import { describe, expect, it } from "vitest";

import {
  initialPlannerStateV3,
  plannerReducerV3,
} from "../../components/planner-v3/planner-machine";

describe("planner v3 state machine", () => {
  it("keeps the previous plan when a re-search fails", () => {
    const plan = { planId: "plan-1" } as EveningPlanV3;
    const intent = { schemaVersion: "3" } as PlannerIntentV3;
    const planned = {
      ...initialPlannerStateV3,
      candidateSetId: "candidates-1",
      intent,
      phase: "planned" as const,
      plan,
    };
    const searching = plannerReducerV3(planned, {
      intent: { ...intent, partySize: 3 },
      startedAt: 1_000,
      transport: "site-tool",
      type: "SEARCH_STARTED",
    });
    expect(searching.searchPresentation).toEqual({
      startedAt: 1_000,
      transport: "site-tool",
    });
    const failed = plannerReducerV3(searching, {
      error: {
        code: "NO_VALID_PLAN",
        message: "Nothing fits.",
        retryable: false,
      },
      type: "SEARCH_EMPTY",
    });
    expect(failed).toMatchObject({
      phase: "planned",
      plan,
      intent,
      searchPresentation: null,
    });
  });

  it("ignores evidence from another area or pack", () => {
    const intent = {
      area: "shibuya",
      schemaVersion: "3",
    } as PlannerIntentV3;
    const plan = {
      intent,
      packVersion: "1.0.0",
      planId: "plan-1",
      stops: [{ place: { placeId: "place-1" } }],
    } as EveningPlanV3;
    const planned = {
      ...initialPlannerStateV3,
      candidateSetId: "candidates-1",
      intent,
      phase: "planned" as const,
      plan,
    };
    const staleEvidence = {
      area: "shinjuku",
      packVersion: "9.9.9",
      placeId: "place-1",
      schemaVersion: "3",
    } as PlaceEvidenceV3;
    expect(
      plannerReducerV3(planned, {
        evidence: staleEvidence,
        type: "EVIDENCE_SUCCEEDED",
      }).evidenceByPlace,
    ).toEqual({});
  });
});
