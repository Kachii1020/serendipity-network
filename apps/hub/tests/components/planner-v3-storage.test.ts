import { composeEveningPlanV3 } from "@serendipity/bundle-engine/planner-v3";
import type {
  PlaceEvidenceV3,
  PlannerIntentV3,
} from "@serendipity/contracts/planner-v3";
import { describe, expect, it } from "vitest";

import {
  SAVED_PLAN_STORAGE_KEY_V3,
  loadSavedPlansV3,
  savePlanSnapshotV3,
} from "../../components/planner-v3/planner-storage";
import {
  getAreaDataPackV3,
  getPlaceEvidenceV3,
  getReviewedPackClaimsV3,
} from "../../data/planner-v3";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
};

const validSnapshot = async () => {
  const intent: PlannerIntentV3 = {
    schemaVersion: "3",
    area: "shibuya",
    partySize: 2,
    startAt: "2026-08-31T17:00:00+09:00",
    endAt: "2026-08-31T22:00:00+09:00",
    budgetPerPersonYen: 4_000,
    includeMeal: true,
    interestPreset: "SURPRISE",
    maxWalkMinutesPerLeg: 20,
    excludedTags: [],
  };
  const composed = await composeEveningPlanV3({
    asOf: new Date("2026-08-30T13:00:00+09:00"),
    dataPack: getAreaDataPackV3(intent.area),
    intent,
    reviewedClaims: getReviewedPackClaimsV3(intent.area),
  });
  if (!composed.ok) throw new Error(`Fixture failed: ${composed.code}`);
  const evidenceByPlace = Object.fromEntries(
    composed.plan.stops.map(({ place }) => {
      const evidence = getPlaceEvidenceV3(intent.area, place.placeId);
      if (!evidence) throw new Error(`Missing evidence: ${place.placeId}`);
      return [place.placeId, evidence];
    }),
  ) as Record<string, PlaceEvidenceV3>;
  return {
    evidenceByPlace,
    intent,
    itinerary: composed.plan,
    savedAt: "2026-08-30T05:00:00.000Z",
    savedPlanId: composed.plan.planId,
    schemaVersion: "3" as const,
  };
};

describe("planner v3 storage", () => {
  it("ignores malformed and Google-derived snapshots", () => {
    const storage = memoryStorage();
    storage.values.set(
      SAVED_PLAN_STORAGE_KEY_V3,
      JSON.stringify({
        schemaVersion: "3",
        records: [
          { schemaVersion: "3", priceRange: { startPrice: 1000 } },
          { schemaVersion: "3", currentOpeningHours: [] },
        ],
      }),
    );
    const result = loadSavedPlansV3(storage);
    expect(result).toEqual({ corrupt: true, records: [] });
  });

  it("round-trips a complete official-evidence snapshot", async () => {
    const storage = memoryStorage();
    const snapshot = await validSnapshot();
    const saved = savePlanSnapshotV3(storage, snapshot);
    expect(saved).toMatchObject({ ok: true, status: "SAVED" });
    expect(loadSavedPlansV3(storage)).toMatchObject({
      corrupt: false,
      records: [{ savedPlanId: snapshot.savedPlanId }],
    });
  });

  it("rejects incomplete, stale-pack, and unlinked evidence", async () => {
    const snapshot = await validSnapshot();
    const placeId = snapshot.itinerary.stops[0]!.place.placeId;

    const incomplete = {
      ...snapshot,
      evidenceByPlace: Object.fromEntries(
        Object.entries(snapshot.evidenceByPlace).filter(
          ([candidateId]) => candidateId !== placeId,
        ),
      ),
    };
    expect(savePlanSnapshotV3(memoryStorage(), incomplete)).toMatchObject({
      code: "STORAGE_CORRUPT",
      ok: false,
    });

    const evidence = snapshot.evidenceByPlace[placeId]!;
    const stalePack = {
      ...snapshot,
      evidenceByPlace: {
        ...snapshot.evidenceByPlace,
        [placeId]: { ...evidence, packVersion: "9.9.9" },
      },
    };
    expect(savePlanSnapshotV3(memoryStorage(), stalePack)).toMatchObject({
      code: "STORAGE_CORRUPT",
      ok: false,
    });

    const unlinked = {
      ...snapshot,
      evidenceByPlace: {
        ...snapshot.evidenceByPlace,
        [placeId]: {
          ...evidence,
          claims: {
            ...evidence.claims,
            identity: {
              ...evidence.claims.identity,
              sourceUrl: "https://example.com/unreviewed",
            },
          },
        },
      },
    };
    expect(savePlanSnapshotV3(memoryStorage(), unlinked)).toMatchObject({
      code: "STORAGE_CORRUPT",
      ok: false,
    });
  });

  it("keeps valid records when a sibling record is corrupt", async () => {
    const storage = memoryStorage();
    const snapshot = await validSnapshot();
    storage.values.set(
      SAVED_PLAN_STORAGE_KEY_V3,
      JSON.stringify({
        records: [snapshot, { schemaVersion: "3" }],
        schemaVersion: "3",
      }),
    );
    const loaded = loadSavedPlansV3(storage);
    expect(loaded.corrupt).toBe(true);
    expect(loaded.records).toHaveLength(1);
    expect(loaded.records[0]?.savedPlanId).toBe(snapshot.savedPlanId);
  });
});
