import { composeEveningPlan } from "@serendipity/bundle-engine/planner-v2";
import type { PlannerIntentV2 } from "@serendipity/contracts/planner-v2";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  getPlaceEvidenceV2,
  SHIBUYA_ACTIVE_PACK_V2,
} from "../../data/shibuya-v2";
import reviewedClaimLedger from "../../data/shibuya-v2.reviewed-claims.json";
import {
  SAVED_PLAN_LIMIT,
  SAVED_PLAN_STORAGE_KEY,
  deletePlanSnapshot,
  loadSavedPlans,
  savePlanSnapshot,
  type SavedPlanRecordV2,
} from "../../components/planner-v2/planner-storage";

const intent: PlannerIntentV2 = {
  schemaVersion: "2",
  area: "shibuya",
  partySize: 1,
  startAt: "2026-08-30T17:00:00+09:00",
  endAt: "2026-08-30T22:00:00+09:00",
  totalBudgetYen: 5_000,
  stopCount: "AUTO",
  maxWalkMinutesPerLeg: 20,
  preferredTags: ["art", "books", "quiet"],
  excludedTags: ["alcohol", "smoking"],
};

const memoryStorage = (initial?: string) => {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(SAVED_PLAN_STORAGE_KEY, initial);
  const setItem = vi.fn((key: string, value: string) => values.set(key, value));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem,
  };
};

let baseRecord: SavedPlanRecordV2;

const record = (id: string): SavedPlanRecordV2 => {
  const itinerary = structuredClone(baseRecord.itinerary);
  return {
    ...structuredClone(baseRecord),
    itinerary: { ...itinerary, planId: id },
    savedPlanId: id,
  };
};

const documentWith = (...records: unknown[]): string =>
  JSON.stringify({ records, schemaVersion: "2" });

describe("planner v2 local saved plans", () => {
  beforeAll(async () => {
    const composed = await composeEveningPlan({
      asOf: new Date("2026-08-30T08:00:00.000Z"),
      dataPack: SHIBUYA_ACTIVE_PACK_V2,
      intent,
      reviewedClaims: reviewedClaimLedger,
    });
    if (!composed.ok) throw new Error("Expected realistic planner fixture");
    const evidence = Object.fromEntries(
      composed.plan.stops.map(({ place }) => {
        const value = getPlaceEvidenceV2(place.placeId);
        if (!value) throw new Error(`Missing evidence for ${place.placeId}`);
        return [place.placeId, value];
      }),
    );
    baseRecord = {
      evidence,
      intent,
      itinerary: composed.plan,
      savedAt: "2026-08-30T12:00:00.000Z",
      savedPlanId: composed.plan.planId,
    };
  });

  it("saves a complete immutable snapshot, reloads it, and recognizes it idempotently", () => {
    const storage = memoryStorage();
    expect(savePlanSnapshot(storage, record("plan-1"))).toMatchObject({
      ok: true,
      status: "SAVED",
    });
    const loaded = loadSavedPlans(storage);
    expect(loaded).toMatchObject({
      corrupt: false,
      records: [{ savedPlanId: "plan-1" }],
    });
    expect(Object.keys(loaded.records[0]?.evidence ?? {})).toHaveLength(
      baseRecord.itinerary.stops.length,
    );

    const writes = storage.setItem.mock.calls.length;
    expect(savePlanSnapshot(storage, record("plan-1"))).toMatchObject({
      ok: true,
      status: "ALREADY_SAVED",
    });
    expect(storage.setItem).toHaveBeenCalledTimes(writes);
  });

  it("never silently evicts the oldest record", () => {
    const storage = memoryStorage();
    for (let index = 0; index < SAVED_PLAN_LIMIT; index += 1) {
      expect(savePlanSnapshot(storage, record(`plan-${index}`)).ok).toBe(true);
    }
    expect(savePlanSnapshot(storage, record("plan-overflow"))).toMatchObject({
      ok: false,
      code: "STORAGE_LIMIT_REACHED",
    });
    expect(loadSavedPlans(storage).records).toHaveLength(SAVED_PLAN_LIMIT);
  });

  it("deletes idempotently without writing for an absent record", () => {
    const storage = memoryStorage();
    savePlanSnapshot(storage, record("plan-1"));
    expect(deletePlanSnapshot(storage, "plan-1")).toMatchObject({
      ok: true,
      status: "DELETED",
    });
    const writes = storage.setItem.mock.calls.length;
    expect(deletePlanSnapshot(storage, "plan-1")).toMatchObject({
      ok: true,
      status: "NOT_FOUND",
    });
    expect(storage.setItem).toHaveBeenCalledTimes(writes);
  });

  it("preserves an unreadable document instead of overwriting it", () => {
    const storage = memoryStorage("not-json");
    expect(loadSavedPlans(storage)).toEqual({ corrupt: true, records: [] });
    expect(savePlanSnapshot(storage, record("plan-1"))).toMatchObject({
      ok: false,
      code: "STORAGE_CORRUPT",
    });
    expect(storage.getItem(SAVED_PLAN_STORAGE_KEY)).toBe("not-json");
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("keeps valid records, drops a poisoned record, and sanitizes on the next mutation", () => {
    const poisoned = {
      ...record("plan-poisoned"),
      apiKey: "must-not-cross",
    };
    const storage = memoryStorage(documentWith(record("plan-1"), poisoned));

    expect(loadSavedPlans(storage)).toMatchObject({
      corrupt: true,
      records: [{ savedPlanId: "plan-1" }],
    });
    expect(savePlanSnapshot(storage, record("plan-2"))).toMatchObject({
      ok: true,
      status: "SAVED",
      records: [{ savedPlanId: "plan-2" }, { savedPlanId: "plan-1" }],
    });
    const repaired = storage.getItem(SAVED_PLAN_STORAGE_KEY) ?? "";
    expect(repaired).not.toContain("must-not-cross");
    expect(repaired).not.toContain("apiKey");
    expect(loadSavedPlans(storage).corrupt).toBe(false);
  });

  it("drops malformed nested plans while retaining independent valid records", () => {
    const malformed = structuredClone(record("plan-malformed")) as unknown as {
      itinerary: { stops: Array<{ position: number }> };
    };
    malformed.itinerary.stops[0]!.position = 2;
    const storage = memoryStorage(documentWith(malformed, record("plan-safe")));

    expect(loadSavedPlans(storage)).toMatchObject({
      corrupt: true,
      records: [{ savedPlanId: "plan-safe" }],
    });
  });

  it("rejects missing or mismatched evidence instead of persisting a partial snapshot", () => {
    const partial = structuredClone(record("plan-partial"));
    const firstPlaceId = partial.itinerary.stops[0]!.place.placeId;
    delete (partial.evidence as Record<string, unknown>)[firstPlaceId];
    const storage = memoryStorage();

    expect(savePlanSnapshot(storage, partial)).toMatchObject({
      ok: false,
      code: "STORAGE_CORRUPT",
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("rejects HTML-bearing snapshots and generic credential fields", () => {
    const html = structuredClone(record("plan-html")) as unknown as {
      itinerary: { stops: Array<{ place: { summary: string } }> };
    };
    html.itinerary.stops[0]!.place.summary = "<strong>poison</strong>";
    const credential = {
      ...record("plan-key"),
      evidence: {
        ...record("plan-key").evidence,
        privateKey: "must-not-cross",
      },
    };
    const storage = memoryStorage();

    expect(
      savePlanSnapshot(storage, html as unknown as SavedPlanRecordV2),
    ).toMatchObject({ ok: false, code: "STORAGE_CORRUPT" });
    expect(
      savePlanSnapshot(storage, credential as unknown as SavedPlanRecordV2),
    ).toMatchObject({ ok: false, code: "STORAGE_CORRUPT" });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("rejects impossible calendar timestamps throughout saved snapshots", () => {
    const mutations: Array<(candidate: SavedPlanRecordV2) => void> = [
      (candidate) => {
        (candidate as { savedAt: string }).savedAt = "2026-09-31T12:00:00.000Z";
      },
      (candidate) => {
        (candidate.itinerary.stops[0] as { startsAt: string }).startsAt =
          "2026-09-31T17:00:00+09:00";
      },
      (candidate) => {
        (
          candidate.itinerary.stops[0] as { sourceCheckedAt: string }
        ).sourceCheckedAt = "2026-09-31T12:00:00+09:00";
      },
      (candidate) => {
        (candidate.itinerary.totals as { endsAt: string }).endsAt =
          "2026-09-31T22:00:00+09:00";
      },
      (candidate) => {
        const evidence = Object.values(candidate.evidence)[0]!;
        (evidence as { evidenceAsOf: string }).evidenceAsOf =
          "2026-09-31T12:00:00+09:00";
      },
      (candidate) => {
        const source = Object.values(candidate.evidence)[0]!.sources[0]!;
        (source as { checkedAt: string }).checkedAt =
          "2026-09-31T12:00:00+09:00";
      },
      (candidate) => {
        const source = Object.values(candidate.evidence)[0]!.sources[0]!;
        (source as { publishedAt: string }).publishedAt =
          "2026-09-31T12:00:00Z";
      },
      (candidate) => {
        const claim = Object.values(candidate.evidence)[0]!.claims.hours;
        (claim as { checkedAt: string }).checkedAt =
          "2026-09-31T12:00:00+09:00";
      },
    ];

    for (const mutate of mutations) {
      const candidate = structuredClone(record("plan-impossible-date"));
      mutate(candidate);
      const storage = memoryStorage();
      expect(savePlanSnapshot(storage, candidate)).toMatchObject({
        ok: false,
        code: "STORAGE_CORRUPT",
      });
      expect(storage.setItem).not.toHaveBeenCalled();
    }
  });

  it("deduplicates a corrupt document deterministically and preserves the first valid snapshot", () => {
    const first = record("plan-duplicate");
    const second = {
      ...record("plan-duplicate"),
      savedAt: "2026-08-30T13:00:00.000Z",
    };
    const storage = memoryStorage(documentWith(first, second));

    const loaded = loadSavedPlans(storage);
    expect(loaded.corrupt).toBe(true);
    expect(loaded.records).toHaveLength(1);
    expect(loaded.records[0]?.savedAt).toBe(first.savedAt);
  });

  it("fails closed when browser storage cannot be read or written", () => {
    const unreadable = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: vi.fn(),
    };
    expect(savePlanSnapshot(unreadable, record("plan-1"))).toMatchObject({
      ok: false,
      code: "STORAGE_CORRUPT",
    });

    const unwritable = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(savePlanSnapshot(unwritable, record("plan-1"))).toMatchObject({
      ok: false,
      code: "STORAGE_UNAVAILABLE",
    });
  });
});
