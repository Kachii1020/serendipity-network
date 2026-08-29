import { composeEveningPlan } from "@serendipity/bundle-engine/planner-v2";
import type { PlannerIntentV2 } from "@serendipity/contracts/planner-v2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlannerPlan } from "../../components/planner-v2/planner-plan";
import { PlannerConnectionStatus } from "../../components/planner-v2/planner-connection";
import { PlannerForm } from "../../components/planner-v2/planner-form";
import { SHIBUYA_ACTIVE_PACK_V2 } from "../../data/shibuya-v2";
import reviewedClaimLedger from "../../data/shibuya-v2.reviewed-claims.json";

const intent: PlannerIntentV2 = {
  area: "shibuya",
  endAt: "2026-08-30T22:00:00+09:00",
  excludedTags: [],
  maxWalkMinutesPerLeg: 20,
  partySize: 1,
  preferredTags: ["art", "quiet"],
  schemaVersion: "2",
  startAt: "2026-08-30T17:00:00+09:00",
  stopCount: "AUTO",
  totalBudgetYen: 5000,
};

describe("planner v2 product UI", () => {
  it("claims agent connectivity only after all tools register", () => {
    const connected = renderToStaticMarkup(
      createElement(PlannerConnectionStatus, { mode: "connected" }),
    );
    const failed = renderToStaticMarkup(
      createElement(PlannerConnectionStatus, { mode: "failed" }),
    );

    expect(connected).toContain("Agent tools connected");
    expect(failed).toContain("Manual controls");
    expect(failed).toContain("could not be registered safely");
    expect(failed).not.toContain("Agent tools connected");
  });

  it("disables past starts and exposes assistant-added constraints", () => {
    const markup = renderToStaticMarkup(
      createElement(PlannerForm, {
        defaults: {
          budget: 7777,
          date: "2026-08-30",
          end: "22:15",
          excludedTags: ["food"],
          interests: ["art", "hands-on", "lively", "quiet"],
          start: "20:15",
          walk: 17,
        },
        earliestStartToday: "20:00",
        maxDate: "2026-09-06",
        minDate: "2026-08-30",
      }),
    );

    expect(markup).toContain('<option disabled="" value="19:30">');
    expect(markup).toContain('<option value="20:15" selected="">');
    expect(markup).toContain("Hands-on");
    expect(markup).toContain("Lively");
    expect(markup).toContain("Food");
    expect(markup).toContain('value="7777"');
    expect(markup).toContain('value="17"');
  });

  it("renders one actionable plan with places, costs, travel, and sources", async () => {
    const result = await composeEveningPlan({
      asOf: new Date("2026-08-30T03:00:00.000Z"),
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      intent,
      reviewedClaims: reviewedClaimLedger,
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
        warnings: ["One source is older than 14 days; verify before going."],
      }),
    );

    expect(markup).toContain("sourced stops");
    expect(markup).toContain("estimated walking");
    expect(markup).toContain("Check official site");
    expect(markup).toContain("Save this plan");
    expect(markup).toContain("not live availability");
    expect(markup).toContain("Recheck recommended");
    expect(markup).toContain("older than 14 days");
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
