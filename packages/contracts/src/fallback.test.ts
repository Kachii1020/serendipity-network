import { describe, expect, it } from "vitest";

import {
  assertPublicPayloadSafe,
  contractValidators,
  directComposeInputSchema,
  directPrepareConfirmationDataSchema,
  directPrepareHoldDataSchema,
  directPrepareReleaseDataSchema,
  directRecordConfirmationInputSchema,
  directRecordHoldInputSchema,
  directRecordReleaseInputSchema,
  providerToolConfirmInputSchema,
  providerToolHoldInputSchema,
  providerToolReleaseInputSchema,
} from "./index";

const browserSessionId = "browser-session-direct";
const holdSafeReference = "safe-kiln";

describe("direct fallback contracts", () => {
  it("T065 keeps private tokens and idempotency keys out of every public fallback schema", () => {
    const publicSchemas = [
      providerToolHoldInputSchema,
      providerToolConfirmInputSchema,
      providerToolReleaseInputSchema,
      directComposeInputSchema,
      directPrepareHoldDataSchema,
      directRecordHoldInputSchema,
      directPrepareReleaseDataSchema,
      directRecordReleaseInputSchema,
      directPrepareConfirmationDataSchema,
      directRecordConfirmationInputSchema,
    ];
    expect(JSON.stringify(publicSchemas)).not.toMatch(
      /holdToken|idempotencyKey|serviceRoleKey/i,
    );
    expect(assertPublicPayloadSafe(publicSchemas)).toEqual({ ok: true });
  });

  it("T065 accepts only safe Provider mutation inputs and rejects injected private fields", () => {
    const hold = {
      browserSessionId,
      clientRequestId: "request-kiln",
      inventoryVersion: "inventory-1",
      quantity: 1,
      schemaVersion: "1",
      slotId: "slot-kiln",
    };
    const confirm = {
      browserSessionId,
      holdSafeReference,
      schemaVersion: "1",
    };
    const release = {
      ...confirm,
      reason: "USER_CANCELLED",
    };
    expect(contractValidators.providerToolHoldInput(hold)).toBe(true);
    expect(contractValidators.providerToolConfirmInput(confirm)).toBe(true);
    expect(contractValidators.providerToolReleaseInput(release)).toBe(true);
    expect(
      contractValidators.providerToolHoldInput({
        ...hold,
        idempotencyKey: "private",
      }),
    ).toBe(false);
    expect(
      contractValidators.providerToolConfirmInput({
        ...confirm,
        holdToken: "private",
      }),
    ).toBe(false);
  });

  it("T065 bounds Provider result collection cardinality at contract boundaries", () => {
    expect(
      contractValidators.directComposeInput({
        intent: {},
        providerResults: [],
        schemaVersion: "1",
      }),
    ).toBe(false);
    expect(
      contractValidators.directRecordHoldInput({
        bundleHoldId: "hold",
        bundleSessionId: "session",
        providerResults: [],
        schemaVersion: "1",
      }),
    ).toBe(false);
    expect(
      contractValidators.directRecordConfirmationInput({
        bundleHoldId: "hold",
        bundleSessionId: "session",
        providerResults: [],
        schemaVersion: "1",
      }),
    ).toBe(false);
  });
});
