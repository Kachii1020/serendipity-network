import { describe, expect, it } from "vitest";

import { buildSafeAuditFacts } from "./audit";

describe("safe audit facts", () => {
  it("copies only typed allowlisted facts", () => {
    expect(
      buildSafeAuditFacts({
        bundleId: "bundle-1",
        candidateCount: 3,
        failedProvider: "nori",
        holdToken: "private",
        httpStatus: 409,
        idempotencyKey: "private",
        rawPrompt: "private",
        retryCount: 1,
        slotCount: 9,
        sql: "private",
      }),
    ).toEqual({
      bundleId: "bundle-1",
      candidateCount: 3,
      failedProvider: "nori",
      httpStatus: 409,
      retryCount: 1,
      slotCount: 9,
    });
  });

  it("drops malformed values rather than coercing them", () => {
    expect(
      buildSafeAuditFacts({
        candidateCount: -1,
        failedProvider: "unknown",
        httpStatus: 999,
        retryCount: "1",
      }),
    ).toEqual({});
  });
});
