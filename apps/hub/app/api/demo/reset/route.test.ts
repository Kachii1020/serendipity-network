import { describe, expect, it, vi } from "vitest";

import { createDemoResetHandler } from "./route";

const request = (secret?: string) =>
  new Request("https://hub.test/api/demo/reset", {
    headers: secret ? { "x-serendipity-operator-secret": secret } : {},
    method: "POST",
  });

describe("POST /api/demo/reset", () => {
  it("runs the idempotent reset only with the demo operator secret", async () => {
    const reset = vi.fn(() =>
      Promise.resolve({ deletedHolds: 3, restoredSlots: 9 }),
    );
    const handler = createDemoResetHandler({
      demoMode: true,
      hubOrigin: "https://hub.test",
      operatorSecret: "operator-secret-with-at-least-thirty-two-bytes",
      reset,
    });
    const response = await handler(
      request("operator-secret-with-at-least-thirty-two-bytes"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { deletedHolds: 3, restoredSlots: 9, status: "RESET" },
    });
    expect(reset).toHaveBeenCalledOnce();
  });

  it("makes disabled, missing, and incorrect authorization indistinguishable", async () => {
    const reset = vi.fn(() =>
      Promise.resolve({ deletedHolds: 0, restoredSlots: 9 }),
    );
    const enabled = createDemoResetHandler({
      demoMode: true,
      hubOrigin: "https://hub.test",
      operatorSecret: "operator-secret-with-at-least-thirty-two-bytes",
      reset,
    });
    const disabled = createDemoResetHandler({
      demoMode: false,
      hubOrigin: "https://hub.test",
      operatorSecret: "operator-secret-with-at-least-thirty-two-bytes",
      reset,
    });
    const responses = await Promise.all([
      enabled(request()),
      enabled(request("wrong-secret")),
      disabled(request("operator-secret-with-at-least-thirty-two-bytes")),
    ]);
    const bodies = (await Promise.all(
      responses.map((response) => response.json()),
    )) as Array<Record<string, unknown>>;
    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404]);
    for (const body of bodies) {
      expect(body).toMatchObject({
        error: {
          code: "TOOL_NOT_FOUND",
          message: "This endpoint is not available.",
          retryable: false,
        },
        ok: false,
        schemaVersion: "1",
      });
    }
    expect(reset).not.toHaveBeenCalled();
  });
});
