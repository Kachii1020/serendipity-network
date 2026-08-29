import {
  PLANNER_SCHEMA_VERSION,
  validatePlannerEnvelopeV2,
  validateEveningPlanV2,
  type EveningPlanV2,
  type PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SHIBUYA_ACTIVE_PACK_V2 } from "../../../../../data/shibuya-v2";
import { searchEveningPlanAgainstPackV2 } from "../../../../../lib/planner-v2/runtime";
import { POST, createPlannerSearchPost } from "./route";

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

describe("POST /api/v2/plans/search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T08:00:00.000Z"));
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
      data?: { plan?: EveningPlanV2 };
      ok?: boolean;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe("search-run-1");
    expect(validatePlannerEnvelopeV2(envelope).ok).toBe(true);
    expect(envelope.ok).toBe(true);
    expect(validateEveningPlanV2(envelope.data?.plan).ok).toBe(true);
    expect(
      envelope.data?.plan?.stops.every((stop) =>
        /published .* hours/i.test(stop.openingFit),
      ),
    ).toBe(true);
    expect(JSON.stringify(envelope)).not.toMatch(
      /00:00.?23:59|no set hours|planner-only hours/i,
    );
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

  it("cannot return search success from a CANDIDATE pack", async () => {
    const candidate = structuredClone(SHIBUYA_ACTIVE_PACK_V2);
    candidate.status = "CANDIDATE";
    const post = createPlannerSearchPost(
      (input, signal) =>
        searchEveningPlanAgainstPackV2(input, candidate, signal),
      candidate.packVersion,
    );
    const response = await post(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify(intent),
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR", retryable: false },
    });
  });

  it("returns STALE_DATA_PACK when the requested plan extends beyond validThrough", async () => {
    vi.setSystemTime(new Date("2026-10-28T12:00:00+09:00"));
    const response = await POST(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify({
          ...intent,
          startAt: "2026-10-29T17:00:00+09:00",
          endAt: "2026-10-29T22:00:00+09:00",
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

    const impossibleDate = await POST(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify({
          ...intent,
          endAt: "2026-08-32T22:00:00+09:00",
          startAt: "2026-08-32T17:00:00+09:00",
        }),
        method: "POST",
      }),
    );
    expect(impossibleDate.status).toBe(400);
    expect(await impossibleDate.json()).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
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
