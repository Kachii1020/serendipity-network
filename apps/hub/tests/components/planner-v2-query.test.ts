import { describe, expect, it } from "vitest";

import {
  defaultPlannerForm,
  normalizePlannerQuery,
  plannerFormDefaultsFromIntent,
  plannerIntentFromDefaults,
  plannerSearchParamsFromDefaults,
  tokyoDate,
  toTokyoTimestamp,
} from "../../components/planner-v2/planner-query";

const clock = new Date("2026-08-29T08:00:00.000Z");

describe("planner v2 query boundary", () => {
  it("derives defaults from the Tokyo service date", () => {
    expect(tokyoDate(0, clock)).toBe("2026-08-29");
    expect(tokyoDate(7, clock)).toBe("2026-09-05");
    expect(defaultPlannerForm(clock)).toMatchObject({
      budget: 5000,
      date: "2026-08-29",
      end: "22:00",
      start: "17:00",
      walk: 20,
    });
  });

  it("normalizes an allowlisted explicit planner request", () => {
    const result = normalizePlannerQuery(
      {
        auto: "1",
        budget: "8000",
        date: "2026-08-31",
        end: "22:30",
        exclude: ["alcohol", "smoking"],
        interests: ["music", "food"],
        start: "17:30",
        walk: "10",
      },
      clock,
    );

    expect(result.invalid).toBe(false);
    expect(result.autoSearch).toBe(true);
    expect(result.defaults).toEqual({
      budget: 8000,
      date: "2026-08-31",
      end: "22:30",
      excludedTags: ["alcohol", "smoking"],
      interests: ["food", "music"],
      start: "17:30",
      walk: 10,
    });
  });

  it("fails closed to defaults for unknown fields and unsafe windows", () => {
    const result = normalizePlannerQuery(
      {
        auto: "yes",
        budget: "999999",
        date: "2027-01-01",
        end: "02:00",
        interests: ["music", "not-a-tag"],
        secret: "do-not-keep",
        start: "23:00",
      },
      clock,
    );

    expect(result.invalid).toBe(true);
    expect(result.autoSearch).toBe(false);
    expect(result.defaults).toEqual({
      ...defaultPlannerForm(clock),
      interests: ["music"],
    });
    expect(result.normalized.toString()).not.toContain("secret");
  });

  it("creates explicit Tokyo timestamps", () => {
    expect(toTokyoTimestamp("2026-08-31", "17:30")).toBe(
      "2026-08-31T17:30:00+09:00",
    );
  });

  it("preserves three unique supported interests without falling back", () => {
    const result = normalizePlannerQuery(
      {
        auto: "1",
        budget: "3000",
        date: "2026-08-29",
        end: "22:00",
        interests: ["art", "books", "quiet"],
        start: "17:00",
        walk: "10",
      },
      clock,
    );

    expect(result.invalid).toBe(false);
    expect(result.defaults.interests).toEqual(["art", "books", "quiet"]);
    expect(result.normalized.getAll("interests")).toEqual([
      "art",
      "books",
      "quiet",
    ]);
  });

  it("caps the selectable horizon at the audited source-pack date", () => {
    const result = normalizePlannerQuery(
      {
        auto: "1",
        date: "2026-09-04",
      },
      clock,
      "2026-09-02",
    );

    expect(result.maxDate).toBe("2026-09-02");
    expect(result.invalid).toBe(true);
    expect(result.defaults.date).toBe("2026-08-29");
    expect(result.normalized.get("date")).toBe("2026-08-29");
  });

  it("preserves an explicit no-interest request instead of restoring defaults", () => {
    const result = normalizePlannerQuery(
      {
        auto: "1",
        budget: "5000",
        date: "2026-08-29",
        end: "22:00",
        interests: "none",
        start: "17:00",
        walk: "20",
      },
      clock,
    );

    expect(result.invalid).toBe(false);
    expect(result.defaults.interests).toEqual([]);
    expect(result.normalized.getAll("interests")).toEqual(["none"]);
  });

  it("rejects a same-day window that already started beyond the grace period", () => {
    const now = new Date("2026-08-29T11:00:00.000Z");
    const result = normalizePlannerQuery(
      {
        auto: "1",
        budget: "5000",
        date: "2026-08-29",
        end: "22:00",
        interests: "art",
        start: "19:30",
        walk: "20",
      },
      now,
    );

    expect(result.invalid).toBe(true);
    expect(result.defaults.start).not.toBe("19:30");
  });

  it("rejects an impossible calendar date instead of normalizing it", () => {
    const result = normalizePlannerQuery(
      {
        auto: "1",
        budget: "5000",
        date: "2026-09-31",
        end: "22:00",
        interests: "art",
        start: "17:00",
        walk: "20",
      },
      new Date("2026-09-29T01:00:00.000Z"),
    );

    expect(result.invalid).toBe(true);
    expect(result.defaults.date).not.toBe("2026-09-31");
  });

  it("moves the default to tomorrow when fewer than two hours remain", () => {
    const late = new Date("2026-08-29T13:00:00.000Z");
    expect(defaultPlannerForm(late)).toMatchObject({
      date: "2026-08-30",
      end: "22:00",
      start: "17:00",
    });
  });

  it("round-trips a custom Site Tool intent through visible form state and URL", () => {
    const intent = {
      area: "shibuya" as const,
      endAt: "2026-08-30T22:15:00+09:00",
      excludedTags: ["food" as const, "smoking" as const],
      maxWalkMinutesPerLeg: 17,
      partySize: 1 as const,
      preferredTags: [
        "art" as const,
        "hands-on" as const,
        "lively" as const,
        "quiet" as const,
      ],
      schemaVersion: "2" as const,
      startAt: "2026-08-30T13:15:00+09:00",
      stopCount: "AUTO" as const,
      totalBudgetYen: 7777,
    };
    const defaults = plannerFormDefaultsFromIntent(intent);
    const params = plannerSearchParamsFromDefaults(defaults);
    const query = Object.fromEntries(
      [...new Set(params.keys())].map((key) => {
        const values = params.getAll(key);
        return [key, values.length === 1 ? values[0] : values];
      }),
    );
    const normalized = normalizePlannerQuery(query, clock);

    expect(normalized.invalid).toBe(false);
    const roundTrip = plannerIntentFromDefaults(normalized.defaults);
    expect({
      ...roundTrip,
      excludedTags: [...roundTrip.excludedTags].sort(),
      preferredTags: [...roundTrip.preferredTags].sort(),
    }).toEqual({
      ...intent,
      excludedTags: [...intent.excludedTags].sort(),
      preferredTags: [...intent.preferredTags].sort(),
    });
  });
});
