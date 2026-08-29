import {
  PLANNER_SCHEMA_VERSION,
  SWAP_PREFERENCES,
  validateEveningPlanV2,
  type PlannerIntentV2,
  type SearchPlansDataV2,
  type SwapPlanInputV2,
} from "@serendipity/contracts/planner-v2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIBUYA_ACTIVE_PACK_V2 } from "../../../../../data/shibuya-v2";
import { searchEveningPlanV2 } from "../../../../../lib/planner-v2/runtime";
import { POST } from "./route";

const intent: PlannerIntentV2 = {
  schemaVersion: PLANNER_SCHEMA_VERSION,
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-30T17:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  totalBudgetYen: 5_000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: ["art", "books", "quiet"],
  excludedTags: [],
};

const swapIntent: PlannerIntentV2 = {
  ...intent,
  startAt: "2026-08-30T13:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  maxWalkMinutesPerLeg: 30,
  preferredTags: [],
};

const findPlan = async (): Promise<SearchPlansDataV2> => {
  const found = await searchEveningPlanV2(
    swapIntent,
    new AbortController().signal,
  );
  if (!found.ok) throw new Error("Expected canonical plan");
  return found.data;
};

describe("POST /api/v2/plans/swap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("performs one stateless stop replacement and preserves every other stop", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const found = await findPlan();
    let successful:
      | {
          input: SwapPlanInputV2;
          response: Response;
          body: {
            data?: { plan?: SearchPlansDataV2["plan"] };
            ok?: boolean;
          };
        }
      | undefined;

    for (const stop of found.plan.stops) {
      for (const preference of SWAP_PREFERENCES) {
        const input: SwapPlanInputV2 = {
          schemaVersion: PLANNER_SCHEMA_VERSION,
          candidateSetId: found.candidateSetId,
          planId: found.plan.planId,
          intent: swapIntent,
          plan: found.plan,
          stopIndex: stop.position,
          preference,
        };
        const response = await POST(
          new Request("https://hub.test/api/v2/plans/swap", {
            body: JSON.stringify(input),
            method: "POST",
          }),
        );
        const body = (await response.json()) as {
          data?: { plan?: SearchPlansDataV2["plan"] };
          ok?: boolean;
        };
        if (body.ok) {
          successful = { body, input, response };
          break;
        }
      }
      if (successful) break;
    }

    expect(successful?.response.status).toBe(200);
    expect(validateEveningPlanV2(successful?.body.data?.plan).ok).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    if (!successful?.body.data?.plan) return;
    for (const stop of found.plan.stops) {
      if (stop.position === successful.input.stopIndex) continue;
      expect(
        successful.body.data.plan.stops[stop.position]?.place.placeId,
      ).toBe(stop.place.placeId);
    }
  });

  it("rejects a stale pack snapshot before swapping", async () => {
    const found = await findPlan();
    const stalePlan = { ...found.plan, packVersion: "9.0.0" };
    const response = await POST(
      new Request("https://hub.test/api/v2/plans/swap", {
        body: JSON.stringify({
          schemaVersion: PLANNER_SCHEMA_VERSION,
          candidateSetId: found.candidateSetId,
          planId: stalePlan.planId,
          intent: swapIntent,
          plan: stalePlan,
          stopIndex: 0,
          preference: "LESS_WALKING",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "STALE_DATA_PACK" },
    });
  });

  it("returns STALE_DATA_PACK after the audited pack horizon", async () => {
    const found = await findPlan();
    vi.setSystemTime(
      new Date(Date.parse(SHIBUYA_ACTIVE_PACK_V2.validThrough) + 1),
    );
    const response = await POST(
      new Request("https://hub.test/api/v2/plans/swap", {
        body: JSON.stringify({
          schemaVersion: PLANNER_SCHEMA_VERSION,
          candidateSetId: found.candidateSetId,
          planId: found.plan.planId,
          intent: found.plan.intent,
          plan: found.plan,
          stopIndex: 0,
          preference: "LESS_WALKING",
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "STALE_DATA_PACK", retryable: false },
    });
  });
});
