import type {
  EveningPlanV2,
  PlannerIntentV2,
} from "@serendipity/contracts/planner-v2";
import { describe, expect, it } from "vitest";

import {
  SAVED_PLAN_LIMIT,
  SAVED_PLAN_STORAGE_KEY,
  deletePlanSnapshot,
  loadSavedPlans,
  savePlanSnapshot,
  type SavedPlanRecordV2,
} from "../../components/planner-v2/planner-storage";

const memoryStorage = (initial?: string) => {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(SAVED_PLAN_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

const record = (id: string): SavedPlanRecordV2 => ({
  evidence: {},
  intent: {
    schemaVersion: "2",
  } as PlannerIntentV2,
  itinerary: {
    planId: id,
  } as EveningPlanV2,
  savedAt: "2026-08-29T12:00:00.000Z",
  savedPlanId: id,
});

describe("planner v2 local saved plans", () => {
  it("saves, reloads, and idempotently recognizes the same plan", () => {
    const storage = memoryStorage();
    expect(savePlanSnapshot(storage, record("plan-1"))).toMatchObject({
      ok: true,
      status: "SAVED",
    });
    expect(loadSavedPlans(storage)).toMatchObject({
      corrupt: false,
      records: [{ savedPlanId: "plan-1" }],
    });
    expect(savePlanSnapshot(storage, record("plan-1"))).toMatchObject({
      ok: true,
      status: "ALREADY_SAVED",
    });
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

  it("deletes idempotently", () => {
    const storage = memoryStorage();
    savePlanSnapshot(storage, record("plan-1"));
    expect(deletePlanSnapshot(storage, "plan-1")).toMatchObject({
      ok: true,
      status: "DELETED",
    });
    expect(deletePlanSnapshot(storage, "plan-1")).toMatchObject({
      ok: true,
      status: "NOT_FOUND",
    });
  });

  it("preserves invalid browser data instead of overwriting it", () => {
    const storage = memoryStorage("not-json");
    expect(loadSavedPlans(storage)).toEqual({ corrupt: true, records: [] });
    expect(savePlanSnapshot(storage, record("plan-1"))).toMatchObject({
      ok: false,
      code: "STORAGE_CORRUPT",
    });
    expect(storage.getItem(SAVED_PLAN_STORAGE_KEY)).toBe("not-json");
  });
});
