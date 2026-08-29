import { describe, expect, it } from "vitest";

import { createRequestHash } from "./hash";
import {
  assertPublicPayloadSafe,
  enforceResultSize,
  sanitizeError,
  validateIntent,
  validateProviderSearchEnvelope,
  validateSlot,
} from "./index";

const canonicalIntent = {
  schemaVersion: "1",
  area: "shibuya",
  startAt: "2030-05-17T18:00:00+09:00",
  endAt: "2030-05-17T22:30:00+09:00",
  totalBudgetYen: 5000,
  partySize: 1,
  preferredTags: ["creative", "seasonal", "experimental"],
  excludedTags: [],
} as const;

const canonicalSlot = {
  slotId: "kiln.beginner-pottery",
  provider: "kiln",
  title: "Beginner pottery",
  category: "workshop",
  startsAt: "2030-05-17T18:15:00+09:00",
  endsAt: "2030-05-17T19:15:00+09:00",
  priceYen: 1500,
  originalPriceYen: 2500,
  capacityRemaining: 2,
  location: {
    locationId: "kiln.main",
    name: "Kiln Studio",
    addressShort: "Shibuya",
    mapX: 12,
    mapY: 18,
  },
  tags: ["creative", "hands-on", "beginner"],
  noveltyScore: 0.9,
  inventoryVersion: "1",
} as const;

describe("contract validation", () => {
  it("CT-001 accepts the canonical intent", () => {
    expect(validateIntent(canonicalIntent)).toEqual({
      ok: true,
      value: canonicalIntent,
    });
  });

  it.each([0, 2, 1.5, undefined])(
    "CT-002 rejects partySize %s",
    (partySize) => {
      expect(validateIntent({ ...canonicalIntent, partySize }).ok).toBe(false);
    },
  );

  it("CT-003 rejects unsupported areas and extra properties", () => {
    expect(validateIntent({ ...canonicalIntent, area: "shinjuku" }).ok).toBe(
      false,
    );
    expect(validateIntent({ ...canonicalIntent, currency: "JPY" }).ok).toBe(
      false,
    );
  });

  it("CT-004 rejects missing offsets, reversed ranges, and cross-date intent", () => {
    expect(
      validateIntent({
        ...canonicalIntent,
        startAt: "2030-05-17T18:00:00",
      }).ok,
    ).toBe(false);
    expect(
      validateIntent({
        ...canonicalIntent,
        startAt: canonicalIntent.endAt,
        endAt: canonicalIntent.startAt,
      }).ok,
    ).toBe(false);
    expect(
      validateIntent({
        ...canonicalIntent,
        endAt: "2030-05-18T00:30:00+09:00",
      }).ok,
    ).toBe(false);
  });

  it("CT-005 bounds and allowlists tags", () => {
    expect(
      validateIntent({
        ...canonicalIntent,
        preferredTags: ["creative", "creative"],
      }).ok,
    ).toBe(false);
    expect(
      validateIntent({ ...canonicalIntent, preferredTags: ["unknown"] }).ok,
    ).toBe(false);
    expect(
      validateIntent({
        ...canonicalIntent,
        preferredTags: [
          "creative",
          "seasonal",
          "experimental",
          "hands-on",
          "music",
          "food",
        ],
      }).ok,
    ).toBe(false);
  });

  it("CT-006 accepts a valid Slot and preserves opaque IDs", () => {
    expect(validateSlot(canonicalSlot)).toEqual({
      ok: true,
      value: canonicalSlot,
    });
  });

  it("CT-007 rejects invalid Slot bounds and chronology", () => {
    expect(validateSlot({ ...canonicalSlot, priceYen: -1 }).ok).toBe(false);
    expect(validateSlot({ ...canonicalSlot, noveltyScore: 1.01 }).ok).toBe(
      false,
    );
    expect(
      validateSlot({
        ...canonicalSlot,
        endsAt: canonicalSlot.startsAt,
      }).ok,
    ).toBe(false);
  });

  it("CT-008/009 rejects malformed envelopes and unknown versions", () => {
    const valid = {
      schemaVersion: "1",
      ok: true,
      data: {
        provider: "kiln",
        slots: [canonicalSlot],
        inventoryAsOf: "2030-05-17T17:55:00+09:00",
      },
      meta: {
        correlationId: "corr-1",
        origin: "https://kiln.example.test",
        completedAt: "2030-05-17T17:55:01+09:00",
      },
    } as const;

    expect(validateProviderSearchEnvelope(valid).ok).toBe(true);
    expect(
      validateProviderSearchEnvelope({ ...valid, schemaVersion: "2" }).ok,
    ).toBe(false);
    expect(
      validateProviderSearchEnvelope({
        ...valid,
        meta: { ...valid.meta, secret: "nope" },
      }).ok,
    ).toBe(false);
  });

  it("CT-010/015 rejects public payloads containing secret field names", () => {
    expect(assertPublicPayloadSafe({ holdSafeReference: "safe-1" })).toEqual({
      ok: true,
    });
    expect(assertPublicPayloadSafe({ holdToken: "secret" }).ok).toBe(false);
    expect(
      assertPublicPayloadSafe({ nested: { idempotencyKey: "secret" } }).ok,
    ).toBe(false);
  });

  it("CT-011/012 produces stable request hashes and detects changes", () => {
    const one = createRequestHash({ quantity: 1, slotId: "slot-a" });
    const reordered = createRequestHash({ slotId: "slot-a", quantity: 1 });
    const changed = createRequestHash({ quantity: 1, slotId: "slot-b" });

    expect(one).toBe(reordered);
    expect(changed).not.toBe(one);
    expect(one).toMatch(/^[a-f0-9]{64}$/);
  });

  it("CT-013 rejects envelopes above 64 KiB", () => {
    expect(enforceResultSize({ value: "ok" }).ok).toBe(true);
    expect(enforceResultSize({ value: "x".repeat(65_536) }).ok).toBe(false);
  });

  it("CT-014 sanitizes arbitrary errors into allowlisted facts", () => {
    const sanitized = sanitizeError({
      code: "PROVIDER_TIMEOUT",
      message: "safe",
      retryable: true,
      provider: "nori",
      safeReference: "safe-1",
      stack: "secret stack",
      sql: "select secret",
      holdToken: "secret",
    });

    expect(sanitized).toEqual({
      code: "PROVIDER_TIMEOUT",
      message: "safe",
      retryable: true,
      provider: "nori",
      safeReference: "safe-1",
    });
  });
});
