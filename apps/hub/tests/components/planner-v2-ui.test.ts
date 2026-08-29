import { composeEveningPlan } from "@serendipity/bundle-engine/planner-v2";
import type { PlannerIntentV2 } from "@serendipity/contracts/planner-v2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlannerPlan } from "../../components/planner-v2/planner-plan";
import { SHIBUYA_ACTIVE_PACK_V2 } from "../../data/shibuya-v2";

const intent: PlannerIntentV2 = {
  area: "shibuya",
  endAt: "2026-08-29T22:00:00+09:00",
  excludedTags: [],
  maxWalkMinutesPerLeg: 20,
  partySize: 1,
  preferredTags: ["art", "quiet"],
  schemaVersion: "2",
  startAt: "2026-08-29T17:00:00+09:00",
  stopCount: "AUTO",
  totalBudgetYen: 5000,
};

describe("planner v2 product UI", () => {
  it("renders one actionable plan with places, costs, travel, and sources", async () => {
    const result = await composeEveningPlan({
      asOf: new Date("2026-08-29T08:00:00.000Z"),
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      intent,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const markup = renderToStaticMarkup(
      createElement(PlannerPlan, {
        changeSummary: null,
        evidenceByPlace: {},
        evidenceLoadingPlaceId: null,
        inlineError: null,
        onDeleteSaved: () => undefined,
        onEvidence: () => undefined,
        onSave: () => undefined,
        onSwap: () => undefined,
        openEvidencePlaceId: null,
        plan: result.plan,
        savedPlans: [],
        storageCorrupt: false,
        storagePending: false,
        swapping: false,
      }),
    );

    expect(markup).toContain("sourced stops");
    expect(markup).toContain("estimated walking");
    expect(markup).toContain("Check official site");
    expect(markup).toContain("Save this plan");
    expect(markup).toContain("not live availability");
    for (const stop of result.plan.stops) {
      expect(markup).toContain(stop.place.name);
      expect(markup).toContain(stop.place.address);
      expect(markup).toContain(stop.price.label);
      expect(markup).toContain(stop.sourcePublisher);
    }
    expect(markup).not.toContain("Kiln");
    expect(markup).not.toContain("Nori");
    expect(markup).not.toContain("Loop");
    expect(markup).not.toContain("Manual fallback");
  });
});
