import type {
  Provider,
  ProviderConfirmData,
  ProviderSearchInput,
  ProviderSearchData,
} from "@serendipity/contracts";
import { canonicalSlotsByProvider } from "@serendipity/test-fixtures";
import { describe, expect, it, vi } from "vitest";

import {
  EVAL_HUB_ORIGIN,
  readEvalFaultMode,
  wrapEvalFaultGateway,
} from "./eval-fault";
import type { ProviderGateway } from "./types";

const success = <T>(provider: Provider, data: T) => ({
  data,
  meta: {
    completedAt: "2030-05-17T09:00:00Z",
    correlationId: `correlation-${provider}`,
    origin: `https://${provider}.test`,
  },
  ok: true as const,
});

const gateway = (provider: Provider) => {
  const confirm = vi.fn(() =>
    Promise.resolve(
      success<ProviderConfirmData>(provider, {
        confirmedAt: "2030-05-17T09:00:00Z",
        holdSafeReference: `hold-${provider}`,
        provider,
        reservationRef: `reservation-${provider}`,
        status: "CONFIRMED",
      }),
    ),
  );
  const hold = vi.fn();
  const api: ProviderGateway = {
    confirm,
    getHoldStatus: vi.fn(),
    hold,
    provider,
    release: vi.fn(),
    search: vi.fn(() =>
      Promise.resolve(
        success<ProviderSearchData>(provider, {
          inventoryAsOf: "2030-05-17T09:00:00Z",
          provider,
          slots: canonicalSlotsByProvider[provider],
        }),
      ),
    ),
  };
  return { api, confirm, hold };
};

const context = {};
const searchInput: ProviderSearchInput = {
  endAt: "2030-05-17T22:30:00+09:00",
  excludedTags: [],
  maxPriceYen: 5000,
  partySize: 1 as const,
  preferredTags: ["creative"],
  schemaVersion: "1" as const,
  startAt: "2030-05-17T18:00:00+09:00",
};

describe("evaluation fault gateway", () => {
  it("fails closed outside the exact isolated demo origin", () => {
    expect(() =>
      readEvalFaultMode({
        DEMO_MODE: "true",
        NEXT_PUBLIC_HUB_ORIGIN: "https://serendipity-phase0-hub.vercel.app",
        SERENDIPITY_EVAL_FAULT: "nori_disappears",
      }),
    ).toThrow(/fixed isolated demo Hub origin/);
    expect(readEvalFaultMode({})).toBeNull();
  });

  it("injects only approved server-side scenarios", () => {
    expect(
      readEvalFaultMode({
        DEMO_MODE: "true",
        NEXT_PUBLIC_HUB_ORIGIN: EVAL_HUB_ORIGIN,
        SERENDIPITY_EVAL_FAULT: "loop_tool_poisoning",
      }),
    ).toBe("loop_tool_poisoning");
    expect(() =>
      readEvalFaultMode({
        DEMO_MODE: "true",
        NEXT_PUBLIC_HUB_ORIGIN: EVAL_HUB_ORIGIN,
        SERENDIPITY_EVAL_FAULT: "arbitrary",
      }),
    ).toThrow(/not an approved scenario/);
  });

  it("keeps poisoning inert in a valid Loop search result", async () => {
    const wrapped = wrapEvalFaultGateway(
      gateway("loop").api,
      "loop_tool_poisoning",
    );
    const result = await wrapped.search(searchInput, context);
    expect(result.ok && result.data.slots[0]?.title).toMatch(
      /^FAULT-TOOL-POISONING/,
    );
  });

  it("fails only the Nori hold before mutation", async () => {
    const base = gateway("nori");
    const wrapped = wrapEvalFaultGateway(base.api, "nori_disappears");
    const result = await wrapped.hold(
      {
        browserSessionId: "browser-session",
        clientRequestId: "client-request",
        idempotencyKey: "a".repeat(32),
        inventoryVersion: "version",
        quantity: 1,
        schemaVersion: "1",
        slotId: "nori.counter",
      },
      context,
    );
    expect(result).toMatchObject({
      error: { code: "SLOT_UNAVAILABLE", provider: "nori" },
      ok: false,
    });
    expect(base.hold).not.toHaveBeenCalled();
  });

  it("drops a committed Loop confirm response so status reconciliation owns truth", async () => {
    const base = gateway("loop");
    const wrapped = wrapEvalFaultGateway(
      base.api,
      "loop_confirm_response_lost",
    );
    const result = await wrapped.confirm(
      {
        browserSessionId: "browser-session",
        holdSafeReference: "hold-loop",
        idempotencyKey: "b".repeat(32),
        schemaVersion: "1",
      },
      context,
    );
    expect(base.confirm).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      error: { code: "PROVIDER_TIMEOUT", provider: "loop" },
      failureType: "offline",
      ok: false,
    });
  });
});
