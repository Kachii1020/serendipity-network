import { describe, expect, it } from "vitest";

import { validateIntent, validateSlot } from "@serendipity/contracts";

import {
  canonicalIntent,
  canonicalSlotsByProvider,
  canonicalTravelTimes,
  faultFixtures,
} from "./index";

describe("canonical fixtures", () => {
  it("validates the intent and every slot", () => {
    expect(validateIntent(canonicalIntent).ok).toBe(true);
    expect(
      Object.values(canonicalSlotsByProvider)
        .flat()
        .every((slot) => validateSlot(slot).ok),
    ).toBe(true);
  });

  it("pins the canonical route travel pairs", () => {
    expect(canonicalTravelTimes["kiln.main"]?.["nori.counter"]).toBe(20);
    expect(canonicalTravelTimes["nori.counter"]?.["loop.room"]).toBe(18);
  });

  it("names every deterministic fault fixture", () => {
    expect(Object.keys(faultFixtures)).toEqual([
      "FAULT-NORI-DISAPPEARS",
      "FAULT-SEARCH-TIMEOUT",
      "FAULT-HOLD-RESPONSE-LOST",
      "FAULT-CONFIRM-RESPONSE-LOST",
      "FAULT-MALFORMED-PROVIDER",
      "FAULT-TOOL-POISONING",
      "FAULT-COMPENSATION-UNREACHABLE",
    ]);
  });
});
