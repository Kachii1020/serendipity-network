import { describe, expect, it } from "vitest";

import {
  defaultPlannerForm,
  normalizePlannerQuery,
  tokyoDate,
  toTokyoTimestamp,
} from "../../components/planner-v2/planner-query";

const clock = new Date("2026-08-29T14:30:00.000Z");

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
    expect(result.defaults.interests).toEqual(["art", "quiet", "books"]);
    expect(result.normalized.getAll("interests")).toEqual([
      "art",
      "quiet",
      "books",
    ]);
  });
});
