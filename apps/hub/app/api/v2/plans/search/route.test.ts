import {
  PLANNER_SCHEMA_VERSION,
  validatePlannerEnvelopeV2,
  validateEveningPlanV2,
  type PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

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

describe("POST /api/v2/plans/search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns one source-backed plan without Provider, Supabase, or external fetch", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await POST(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify(intent),
        headers: {
          "content-type": "application/json",
          "x-correlation-id": "search-run-1",
        },
        method: "POST",
      }),
    );
    const envelope = (await response.json()) as {
      data?: { plan?: unknown };
      ok?: boolean;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe("search-run-1");
    expect(validatePlannerEnvelopeV2(envelope).ok).toBe(true);
    expect(envelope.ok).toBe(true);
    expect(validateEveningPlanV2(envelope.data?.plan).ok).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns an honest 200 failure envelope when no route fits", async () => {
    const response = await POST(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify({
          ...intent,
          preferredTags: [],
          excludedTags: ["art", "books", "hands-on", "outdoors"],
        }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "NO_VALID_PLAN" },
    });
  });

  it("rejects unsupported versions and oversized bodies before composition", async () => {
    const unsupported = await POST(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify({ ...intent, schemaVersion: "1" }),
        method: "POST",
      }),
    );
    expect(unsupported.status).toBe(400);
    expect(await unsupported.json()).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_SCHEMA_VERSION" },
    });

    const oversized = await POST(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify({ ...intent, padding: "x".repeat(17_000) }),
        method: "POST",
      }),
    );
    expect(oversized.status).toBe(400);
    expect(await oversized.json()).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
