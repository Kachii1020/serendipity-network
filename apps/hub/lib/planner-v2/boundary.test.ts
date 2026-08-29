import { describe, expect, it } from "vitest";

import {
  createPlannerFailureEnvelope,
  createPlannerSuccessEnvelope,
  plannerJsonResponse,
} from "./envelope";
import { parsePlannerJson, plannerRequestCorrelationId } from "./request";

const context = {
  clock: () => new Date("2026-08-29T08:00:00.000Z"),
  correlationId: () => "correlation-1",
  origin: "https://hub.test",
  packVersion: "1.0.0",
};

describe("planner v2 HTTP boundary", () => {
  it("creates v2 envelopes with stable safe metadata", () => {
    expect(createPlannerSuccessEnvelope({ plan: "one" }, context)).toEqual({
      schemaVersion: "2",
      ok: true,
      data: { plan: "one" },
      meta: {
        completedAt: "2026-08-29T08:00:00.000Z",
        correlationId: "correlation-1",
        origin: "https://hub.test",
        packVersion: "1.0.0",
      },
    });
    expect(
      createPlannerFailureEnvelope(
        {
          code: "NO_VALID_PLAN",
          message: "No route fits.",
          retryable: false,
        },
        context,
      ),
    ).toMatchObject({
      schemaVersion: "2",
      ok: false,
      error: { code: "NO_VALID_PLAN" },
    });
  });

  it("sets no-store and correlation headers", async () => {
    const response = plannerJsonResponse(
      createPlannerSuccessEnvelope({ plan: "one" }, context),
      200,
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe("correlation-1");
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it("replaces unsafe and oversized success responses with INTERNAL_ERROR", async () => {
    for (const data of [
      { secret: "must-not-cross" },
      { content: "x".repeat(66_000) },
    ]) {
      const response = plannerJsonResponse(
        createPlannerSuccessEnvelope(data, context),
        200,
        context,
      );
      const body = (await response.json()) as {
        error?: { code?: string };
        ok?: boolean;
      };
      expect(response.status).toBe(500);
      expect(body).toMatchObject({
        ok: false,
        error: { code: "INTERNAL_ERROR" },
      });
    }
  });

  it("accepts only bounded JSON bodies", async () => {
    await expect(
      parsePlannerJson(
        new Request("https://hub.test/api/v2/plans/search", {
          body: JSON.stringify({ schemaVersion: "2" }),
          method: "POST",
        }),
      ),
    ).resolves.toEqual({ ok: true, value: { schemaVersion: "2" } });

    await expect(
      parsePlannerJson(
        new Request("https://hub.test/api/v2/plans/search", {
          body: "not-json",
          method: "POST",
        }),
      ),
    ).resolves.toEqual({ ok: false, reason: "INVALID_JSON" });

    await expect(
      parsePlannerJson(
        new Request("https://hub.test/api/v2/plans/search", {
          body: JSON.stringify({ content: "x".repeat(17_000) }),
          method: "POST",
        }),
      ),
    ).resolves.toEqual({ ok: false, reason: "TOO_LARGE" });
  });

  it("uses only simple bounded incoming correlation IDs", () => {
    expect(
      plannerRequestCorrelationId(
        new Request("https://hub.test/api/v2/plans/search", {
          headers: { "x-correlation-id": "judge-run:1" },
        }),
      ),
    ).toBe("judge-run:1");

    const generated = plannerRequestCorrelationId(
      new Request("https://hub.test/api/v2/plans/search", {
        headers: { "x-correlation-id": "bad id with spaces" },
      }),
    );
    expect(generated).toMatch(/^[0-9a-f-]{36}$/);
  });
});
