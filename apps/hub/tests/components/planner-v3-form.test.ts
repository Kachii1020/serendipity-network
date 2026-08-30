import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlannerFormV3 } from "../../components/planner-v3/planner-form";

describe("planner v3 form projection", () => {
  it("keeps custom walking and excluded-tag intent visible for manual resubmit", () => {
    const markup = renderToStaticMarkup(
      createElement(PlannerFormV3, {
        defaults: {
          area: "shinjuku",
          budgetPerPersonYen: 7777,
          date: "2026-08-30",
          end: "22:15",
          excludedTags: ["art", "coffee-tea", "outdoors"],
          includeMeal: true,
          interestPreset: "HANDS_ON",
          partySize: 3,
          start: "17:15",
          walk: 17,
        },
        earliestStartToday: "12:00",
        maxDate: "2026-09-06",
        minDate: "2026-08-30",
      }),
    );

    expect(markup).toContain('<option value="15">15 minutes</option>');
    expect(markup).toContain(
      '<option value="17" selected="">17 minutes</option>',
    );
    expect(markup).toContain('<option value="25">25 minutes</option>');
    expect(markup).toContain('name="exclude" checked="" value="art"');
    expect(markup).toContain('name="exclude" checked="" value="coffee-tea"');
    expect(markup).toContain('name="exclude" checked="" value="outdoors"');
    expect(markup).toContain("Coffee &amp; tea");
  });

  it("renders all six interest choices as labelled radios", () => {
    const markup = renderToStaticMarkup(
      createElement(PlannerFormV3, {
        defaults: {
          area: "shibuya",
          budgetPerPersonYen: 4000,
          date: "2026-08-30",
          end: "22:30",
          excludedTags: [],
          includeMeal: true,
          interestPreset: "SURPRISE",
          partySize: 1,
          start: "17:30",
          walk: 20,
        },
        earliestStartToday: "12:00",
        maxDate: "2026-09-06",
        minDate: "2026-08-30",
      }),
    );

    expect(markup.match(/name="interest"/g)).toHaveLength(6);
    for (const label of [
      "Surprise me",
      "Art &amp; heritage",
      "Food discovery",
      "Hands-on",
      "Calm &amp; quiet",
      "Lively",
    ]) {
      expect(markup).toContain(`<span>${label}</span>`);
    }
  });
});
