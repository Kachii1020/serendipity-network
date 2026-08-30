import { describe, expect, it } from "vitest";

import type { PlannerIntentV3 } from "@serendipity/contracts/planner-v3";

import { AREA_REGISTRY_V3 } from "../../data/planner-v3";
import {
  AreaRegistryV3,
  DEFAULT_AREA_REGISTRY_V3,
  type AreaRegistryEntryV3,
} from "./area-registry";

const asOf = new Date("2026-08-30T13:00:00+09:00");
const intent = (area: PlannerIntentV3["area"]): PlannerIntentV3 => ({
  schemaVersion: "3",
  area,
  partySize: 2,
  startAt: "2026-08-30T17:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  budgetPerPersonYen: 4_000,
  includeMeal: true,
  interestPreset: "CALM_QUIET",
  maxWalkMinutesPerLeg: 20,
  excludedTags: [],
});

describe("planner v3 AreaRegistry", () => {
  it("resolves all three reviewed ACTIVE hubs", () => {
    for (const area of ["shibuya", "shinjuku", "ikebukuro"] as const) {
      const resolved = DEFAULT_AREA_REGISTRY_V3.resolve(area, {
        asOf,
        intent: intent(area),
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) continue;
      expect(resolved.entry.pack.area).toBe(area);
      expect(resolved.entry.pack.status).toBe("ACTIVE");
      expect(
        resolved.entry.getEvidence(resolved.entry.pack.places[0]!.placeId),
      ).toMatchObject({ area });
    }
  });

  it("maps inactive, stale, mismatched, and unreviewed entries fail closed", () => {
    const base = AREA_REGISTRY_V3.shibuya;
    const entry = (pack = base.pack): AreaRegistryEntryV3 => ({
      pack,
      reviewedClaims: base.reviewedClaims,
      getEvidence: () => null,
    });

    const inactivePack = structuredClone(base.pack);
    (inactivePack as { status: "CANDIDATE" | "ACTIVE" }).status = "CANDIDATE";
    const inactive = new AreaRegistryV3({
      shibuya: entry(inactivePack),
      shinjuku: entry(inactivePack),
      ikebukuro: entry(inactivePack),
    });
    expect(inactive.resolve("shibuya", { asOf })).toEqual({
      ok: false,
      code: "AREA_NOT_ACTIVE",
    });

    expect(
      DEFAULT_AREA_REGISTRY_V3.resolve("shibuya", {
        asOf: new Date(Date.parse(base.pack.validThrough) + 1),
      }),
    ).toEqual({ ok: false, code: "STALE_DATA_PACK" });
    expect(
      DEFAULT_AREA_REGISTRY_V3.resolve("shibuya", {
        asOf,
        intent: intent("shinjuku"),
      }),
    ).toEqual({ ok: false, code: "AREA_NOT_ACTIVE" });
  });
});
