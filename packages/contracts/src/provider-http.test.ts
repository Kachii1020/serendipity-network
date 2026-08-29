import { describe, expect, it } from "vitest";

import { contractValidators, type ProviderHoldHttpData } from "./index";

describe("Provider private HTTP contracts", () => {
  it("separates a private hold token from the public tool result", () => {
    const value = {
      publicResult: {
        provider: "kiln",
        holdSafeReference: "30000000-0000-4000-8000-000000000001",
        slotId: "10000000-0000-4000-8000-000000000001",
        status: "HELD",
        expiresAt: "2030-05-17T09:01:30Z",
      },
      holdToken: "signed-provider-private-hold-token",
    } satisfies ProviderHoldHttpData;

    expect(contractValidators.providerHoldHttpData(value)).toBe(true);
    expect(contractValidators.providerHoldData(value.publicResult)).toBe(true);
    expect(contractValidators.providerHoldData(value)).toBe(false);
  });

  it("validates the demo cancellation HTTP boundary", () => {
    expect(
      contractValidators.demoCancelSlotInput({
        schemaVersion: "1",
        slotId: "10000000-0000-4000-8000-000000000001",
      }),
    ).toBe(true);
    expect(
      contractValidators.demoCancelSlotData({
        provider: "kiln",
        slotId: "10000000-0000-4000-8000-000000000001",
        status: "CANCELLED",
        inventoryVersion: "2",
      }),
    ).toBe(true);
  });

  it("accepts a local Provider origin only for the local HTTP exception", () => {
    expect(
      contractValidators.providerResultEnvelope({
        schemaVersion: "1",
        ok: true,
        data: {},
        meta: {
          completedAt: "2030-05-17T09:00:00Z",
          correlationId: "corr-1",
          origin: "http://localhost:3101",
        },
      }),
    ).toBe(true);
    expect(
      contractValidators.providerResultEnvelope({
        schemaVersion: "1",
        ok: true,
        data: {},
        meta: {
          completedAt: "2030-05-17T09:00:00Z",
          correlationId: "corr-1",
          origin: "http://provider.test",
        },
      }),
    ).toBe(false);
  });
});
