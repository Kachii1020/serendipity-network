import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPlannerEvidenceHandler,
  createPlannerPostHandler,
} from "./handlers";

const validInput = (value: unknown) =>
  typeof value === "object" && value !== null && "schemaVersion" in value
    ? { ok: true as const, value }
    : {
        ok: false as const,
        code: "VALIDATION_ERROR" as const,
        issues: ["invalid"],
      };

describe("planner v2 route handlers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects invalid input before executing planner code", async () => {
    const execute = vi.fn(() => ({ ok: true as const, data: {} }));
    const handler = createPlannerPostHandler({
      execute,
      packVersion: "1.0.0",
      validate: validInput,
    });
    const response = await handler(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify({ wrong: true }),
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns expected no-result and stale outcomes without changing their error", async () => {
    for (const [code, status] of [
      ["NO_VALID_PLAN", 200],
      ["NO_REPLACEMENT", 200],
      ["STALE_PLAN", 409],
      ["INTERNAL_ERROR", 500],
    ] as const) {
      const handler = createPlannerPostHandler({
        execute: () => ({
          ok: false as const,
          error: {
            code,
            message: "Planner outcome.",
            retryable: false,
          },
        }),
        packVersion: "1.0.0",
        validate: validInput,
      });
      const response = await handler(
        new Request("https://hub.test/api/v2/plans/search", {
          body: JSON.stringify({ schemaVersion: "2" }),
          method: "POST",
        }),
      );

      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({
        ok: false,
        error: { code },
      });
    }
  });

  it("returns a bounded success without using external fetch", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const handler = createPlannerPostHandler({
      execute: (_input: unknown, signal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        return { ok: true as const, data: { planId: "plan-1" } };
      },
      packVersion: "1.0.0",
      validate: validInput,
    });
    const response = await handler(
      new Request("https://hub.test/api/v2/plans/search", {
        body: JSON.stringify({ schemaVersion: "2" }),
        headers: { "x-correlation-id": "test-run-1" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe("test-run-1");
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { planId: "plan-1" },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("validates evidence IDs and maps missing places to 404", async () => {
    const getEvidence = vi.fn((placeId: string) =>
      placeId === "known-place"
        ? {
            ok: true as const,
            data: { placeId },
          }
        : {
            ok: false as const,
            error: {
              code: "PLACE_NOT_FOUND" as const,
              message: "Place not found.",
              retryable: false,
            },
          },
    );
    const handler = createPlannerEvidenceHandler({
      getEvidence,
      packVersion: "1.0.0",
    });

    const invalid = await handler(
      new Request("https://hub.test/api/v2/places/bad/evidence"),
      "../../bad",
    );
    expect(invalid.status).toBe(400);
    expect(getEvidence).not.toHaveBeenCalled();

    const missing = await handler(
      new Request("https://hub.test/api/v2/places/missing/evidence"),
      "missing",
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      ok: false,
      error: { code: "PLACE_NOT_FOUND" },
    });
  });
});
